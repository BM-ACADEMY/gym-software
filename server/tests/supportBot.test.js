jest.mock('../utils/whatsapp', () => ({
  ...jest.requireActual('../utils/whatsapp'),
  sendText: jest.fn(async () => ({ ok: true, demo: false })),
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant } = require('./helpers/factories');
const { sendText } = require('../utils/whatsapp');
const Ticket = require('../models/Ticket');
const SupportMessage = require('../models/SupportMessage');
const Admin = require('../models/Admin');

const sign = (raw) => 'sha256=' + crypto.createHmac('sha256', 'app_secret').update(raw).digest('hex');
const payload = (id, from, text) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id, from, type: 'text', text: { body: text } }] } }] }] });
const post = (body, sig) => request(app).post('/api/payments/whatsapp-webhook').set('Content-Type', 'application/json').set('X-Hub-Signature-256', sig || sign(body)).send(body);
const settle = () => new Promise((r) => setTimeout(r, 300)); // replies are sent after the 200

describe('WhatsApp support chatbot', () => {
  let t;
  beforeAll(async () => {
    await db.connect();
    process.env.WHATSAPP_APP_SECRET = 'app_secret';
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify_me';
    t = await createTenant({ gymName: 'Chat Gym' });
    await Admin.updateOne({ _id: t.admin._id }, { $set: { phone: '9876500001' } });
  });
  afterAll(async () => { delete process.env.WHATSAPP_APP_SECRET; delete process.env.WHATSAPP_VERIFY_TOKEN; await db.clearDatabase(); await db.closeDatabase(); });
  beforeEach(() => sendText.mockClear());

  test('verification handshake works only with the right token', async () => {
    const ok = await request(app).get('/api/payments/whatsapp-webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify_me', 'hub.challenge': '12345' });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('12345');
    expect((await request(app).get('/api/payments/whatsapp-webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'bad', 'hub.challenge': '1' })).status).toBe(403);
  });

  test('a bad signature is rejected and nothing is sent', async () => {
    const body = payload('wamid.bad', '919876500001', 'hello');
    expect((await post(body, 'sha256=deadbeef')).status).toBe(401);
    await settle();
    expect(sendText).not.toHaveBeenCalled();
  });

  test('an owner asking how to import gets an answer from the help articles', async () => {
    const body = payload('wamid.q1', '919876500001', 'how do I import members from excel');
    expect((await post(body)).status).toBe(200);
    await settle();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0].text).toMatch(/Import Members/i);
    expect(sendText.mock.calls[0][0].text).toMatch(/AGENT/);
    expect(await Ticket.countDocuments({ subscriberId: t.subscriber._id })).toBe(0);
  });

  test('Meta retrying the same message does not reply twice', async () => {
    const body = payload('wamid.q1', '919876500001', 'how do I import members from excel');
    await post(body);
    await settle();
    expect(sendText).not.toHaveBeenCalled();
  });

  test('asking for a person creates one ticket, tells the owner, then the bot goes quiet', async () => {
    await post(payload('wamid.h1', '919876500001', 'I want to talk to a person about my payment'));
    await settle();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0].text).toMatch(/passed this to our team/);
    const tickets = await Ticket.find({ subscriberId: t.subscriber._id });
    expect(tickets).toHaveLength(1);
    expect(tickets[0].subject).toMatch(/^WhatsApp:/);
    sendText.mockClear();
    await post(payload('wamid.h2', '919876500001', 'hello?'));
    await settle();
    expect(sendText).not.toHaveBeenCalled();
    expect(await Ticket.countDocuments({ subscriberId: t.subscriber._id })).toBe(1);
  });

  test('an unknown number gets a generic reply, no ticket, no gym data', async () => {
    await post(payload('wamid.u1', '919000099999', 'how much does it cost'));
    await settle();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText.mock.calls[0][0].text).toMatch(/free for 14 days/);
    expect(await SupportMessage.countDocuments({ phone: '919000099999', subscriberId: { $exists: true } })).toBe(0);
  });
});
