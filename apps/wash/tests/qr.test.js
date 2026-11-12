const { makeQr, qrSvg, capacity, MAX_VERSION } = require('../src/qr');
test('small text gives version 1 with finder patterns', () => {
  const q = makeQr('hi');
  expect(q.version).toBe(1); expect(q.size).toBe(21);
  expect(q.modules[0][0]).toBe(true); expect(q.modules[0][6]).toBe(true); expect(q.modules[3][3]).toBe(true);
});
test('UPI link fits and renders as svg', () => {
  const svg = qrSvg('upi://pay?pa=shop@upi&pn=Shop&am=250&cu=INR');
  expect(svg.startsWith('<svg')).toBe(true); expect(svg.includes('<path')).toBe(true);
});
test('capacity grows with version and text over the limit throws', () => {
  expect(capacity(2, 'M') > capacity(1, 'M')).toBe(true);
  let threw = false; try { makeQr('x'.repeat(capacity(MAX_VERSION, 'M') + 1)); } catch (e) { threw = true; }
  expect(threw).toBe(true);
});
test('same text gives same code', () => {
  expect(JSON.stringify(makeQr('abc').modules)).toBe(JSON.stringify(makeQr('abc').modules));
});
