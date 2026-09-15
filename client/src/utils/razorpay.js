// Lazy-loads Razorpay's Checkout.js widget (only when a real gateway order is
// created — the dummy/no-gateway path never needs this) and wraps opening it.
let loadPromise = null;

export const loadRazorpayScript = () => {
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.body.appendChild(script);
  });
  return loadPromise;
};

// order: the {orderId, amount, currency, keyId} shape createOrder() returns.
// onSuccess receives {razorpay_order_id, razorpay_payment_id, razorpay_signature}.
export const openRazorpayCheckout = async ({ order, name, description, prefill, onSuccess, onDismiss }) => {
  await loadRazorpayScript();
  const rzp = new window.Razorpay({
    key: order.keyId,
    amount: Math.round(order.amount * 100),
    currency: order.currency || 'INR',
    order_id: order.orderId,
    name: name || 'GymDesk',
    description,
    prefill,
    theme: { color: '#0d9488' },
    handler: (response) => onSuccess(response),
    modal: { ondismiss: () => onDismiss && onDismiss() },
  });
  rzp.open();
};
