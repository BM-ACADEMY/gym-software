const crypto = require('crypto');
const { wantsHuman, extractMessages, tail10 } = require('../services/supportBot');
const { verifyMetaSignature } = require('../utils/whatsapp');

describe('support bot helpers', () => {
  test('detects a request for a person', () => {
    expect(wantsHuman('please let me talk to a person')).toBe(true);
    expect(wantsHuman('AGENT')).toBe(true);
    expect(wantsHuman('I want a refund')).toBe(true);
    expect(wantsHuman('how do I import members')).toBe(false);
  });
  test('reads text messages from the Meta payload and marks other types', () => {
    const body = { entry: [{ changes: [{ value: { messages: [
      { id: 'wamid.1', from: '919876543210', type: 'text', text: { body: 'hello' } },
      { id: 'wamid.2', from: '919876543210', type: 'image' },
    ] } }] }] };
    const m = extractMessages(body);
    expect(m).toHaveLength(2);
    expect(m[0].text).toBe('hello');
    expect(m[1].text).toBeNull();
    expect(extractMessages({})).toHaveLength(0);
  });
  test('last 10 digits identify the number', () => {
    expect(tail10('919876543210')).toBe('9876543210');
    expect(tail10('+91 98765 43210')).toBe('9876543210');
  });
  test('Meta signature check accepts the right one and rejects others', () => {
    const raw = Buffer.from('{"a":1}');
    const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(raw).digest('hex');
    expect(verifyMetaSignature(raw, sig, 'secret')).toBe(true);
    expect(verifyMetaSignature(raw, sig, 'other')).toBe(false);
    expect(verifyMetaSignature(raw, 'sha256=00', 'secret')).toBe(false);
    expect(verifyMetaSignature(raw, undefined, 'secret')).toBe(false);
    expect(verifyMetaSignature(raw, sig, '')).toBe(false);
  });
});
