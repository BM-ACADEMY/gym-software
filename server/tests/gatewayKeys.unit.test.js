// RM-11: Root Admin payment gateway key checks (switching from test to live keys).
const { modeOf, validateGatewayUpdate: v } = require('../services/gatewayKeys');

const testCur = { provider: 'razorpay', keyId: 'rzp_test_AAAAAAAAAAAA', keySecret: 'test_secret_1234' };

describe('payment gateway keys (RM-11)', () => {
  test('mode comes from the key id prefix', () => {
    expect(modeOf('rzp_live_ABCDEF123456')).toBe('live');
    expect(modeOf('rzp_test_ABCDEF123456')).toBe('test');
    expect(modeOf('')).toBe('');
    expect(modeOf('pk_live_x')).toBe('');
  });
  test('a new live key id with a blank secret is refused (would pair it with the old test secret)', () => {
    const r = v({ provider: 'razorpay', keyId: 'rzp_live_BBBBBBBBBBBB' }, testCur);
    expect(r.error).toMatch(/key secret/);
  });
  test('a new live key id with its secret is saved and reported as a mode change', () => {
    const r = v({ provider: 'razorpay', keyId: ' rzp_live_BBBBBBBBBBBB ', keySecret: 'live_secret_9999' }, testCur);
    expect(r.error).toBeUndefined();
    expect(r.value).toEqual({ provider: 'razorpay', keyId: 'rzp_live_BBBBBBBBBBBB', keySecret: 'live_secret_9999' });
    expect(r.mode).toBe('live'); expect(r.modeChanged).toBe(true);
  });
  test('same key id with a blank secret keeps the saved secret', () => {
    const r = v({ provider: 'razorpay', keyId: testCur.keyId }, testCur);
    expect(r.value.keySecret).toBe('test_secret_1234'); expect(r.modeChanged).toBe(false);
  });
  test('a key id that is not a Razorpay one is refused', () => {
    expect(v({ provider: 'razorpay', keyId: 'live_key', keySecret: 's' }, testCur).error).toMatch(/rzp_test_ or rzp_live_/);
  });
  test('secret pasted into both boxes is refused', () => {
    expect(v({ provider: 'razorpay', keyId: 'rzp_live_BBBBBBBBBBBB', keySecret: 'rzp_live_BBBBBBBBBBBB' }, testCur).error).toMatch(/same as the key ID/);
  });
  test('first save on an empty setting is not a mode change', () => {
    const r = v({ provider: 'razorpay', keyId: 'rzp_test_AAAAAAAAAAAA', keySecret: 's1' }, {});
    expect(r.mode).toBe('test'); expect(r.modeChanged).toBe(false);
  });
  test('unknown provider is refused', () => {
    expect(v({ provider: 'paypal' }, testCur).error).toBe('Unknown payment provider');
  });
});
