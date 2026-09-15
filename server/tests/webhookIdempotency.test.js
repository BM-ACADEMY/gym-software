const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createMember } = require('./helpers/factories');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const { buildSimulatedWebhook } = require('../services/paymentGateway');

// The doc requires webhook idempotency for the gateway integration — a
// retried delivery must never double-credit an invoice. The real mechanism
// here is a unique (provider, eventId) index (see models/WebhookEvent.js),
// not an in-memory guard, so this exercises the actual DB constraint.
describe('Payment gateway webhook idempotency', () => {
  let gym, member, payment;

  beforeAll(async () => {
    await db.connect();
    gym = await createTenant({ gymName: 'Webhook Gym' });
    member = (await createMember(gym.subscriber)).member;
    payment = await Payment.create({
      subscriberId: gym.subscriber._id,
      memberId: member._id,
      amount: 2000,
      amountPaid: 0,
      method: 'gateway',
      status: 'pending',
      gatewayOrderId: 'order_dummy_test123',
    });
  });

  afterAll(async () => {
    await db.clearDatabase();
    await db.closeDatabase();
  });

  test('a validly-signed webhook marks the invoice paid', async () => {
    const { payload, signature } = await buildSimulatedWebhook({ orderId: payment.gatewayOrderId, status: 'paid', amount: 2000 });
    const res = await request(app).post('/api/payments/webhook').send({ ...payload, signature });

    expect(res.status).toBe(200);
    expect(res.body.data.duplicate).toBe(false);

    const updated = await Payment.findById(payment._id);
    expect(updated.status).toBe('paid');
    expect(updated.amountPaid).toBe(2000);

    // stash for the replay test
    payment._webhookPayload = payload;
    payment._webhookSignature = signature;
  });

  test('replaying the exact same webhook event is a harmless no-op, not a double-credit', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ ...payment._webhookPayload, signature: payment._webhookSignature });

    expect(res.status).toBe(200);
    expect(res.body.data.duplicate).toBe(true);

    const updated = await Payment.findById(payment._id);
    expect(updated.amountPaid).toBe(2000); // unchanged — no double-credit

    const eventCount = await WebhookEvent.countDocuments({ eventId: payment._webhookPayload.eventId });
    expect(eventCount).toBe(1);
  });

  test('a tampered signature is rejected with 401 and never touches the record', async () => {
    const { payload } = await buildSimulatedWebhook({ orderId: payment.gatewayOrderId, status: 'paid', amount: 2000 });
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ ...payload, signature: 'not-the-real-signature' });

    expect(res.status).toBe(401);

    const stillEvent = await WebhookEvent.findOne({ eventId: payload.eventId });
    expect(stillEvent).toBeNull();
  });

  test('a webhook for an order with no matching payment record returns 404', async () => {
    const { payload, signature } = await buildSimulatedWebhook({ orderId: 'order_dummy_does_not_exist', status: 'paid', amount: 500 });
    const res = await request(app).post('/api/payments/webhook').send({ ...payload, signature });
    expect(res.status).toBe(404);
  });
});
