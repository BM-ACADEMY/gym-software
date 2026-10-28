// One place for the company details shown on public pages.
// Set these in client/.env (VITE_*). Anything left empty is simply not shown,
// so the site never displays made-up or another company's details.
const env = import.meta.env || {};

export const company = {
  product: env.VITE_PRODUCT_NAME || 'GymDesk',
  legalName: env.VITE_COMPANY_LEGAL_NAME || 'Afra Ventures Pvt Ltd',
  email: env.VITE_SUPPORT_EMAIL || '',
  phone: env.VITE_SUPPORT_PHONE || '',        // digits with country code, e.g. 919876543210
  address: env.VITE_COMPANY_ADDRESS || '',
  state: env.VITE_COMPANY_STATE || 'Puducherry',
  social: {
    instagram: env.VITE_SOCIAL_INSTAGRAM || '',
    linkedin: env.VITE_SOCIAL_LINKEDIN || '',
    facebook: env.VITE_SOCIAL_FACEBOOK || '',
    youtube: env.VITE_SOCIAL_YOUTUBE || '',
  },
  // Refund window for a first payment, in days. Mohamed to confirm.
  refundDays: Number(env.VITE_REFUND_DAYS) || 7,
  legalUpdated: 'October 2026',
};

export const prettyPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return d ? `+${d}` : '';
};

export default company;
