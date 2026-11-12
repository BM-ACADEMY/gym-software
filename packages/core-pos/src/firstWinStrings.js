'use strict';
// Words for the first screen and the set-up checklist (Salon, Mart, Dine, Cloth, Wash). English is the source; the Tamil is a
// draft that needs a native speaker's check (M-06). A missing Tamil line falls back to English. {count} and {rupees} are filled in.
// Honest wording rule: a sample is always called a sample, and a number is shown only if it comes from the owner's own records.
const en = {
  sampleLabel: 'Sample numbers, not your data yet. Add your own records, or load sample data to look around. Sample data can be removed in one tap.',
  sampleOnNote: 'Sample data is on. Reports include it until you remove it.',
  nothing: 'Nothing unusual in your records right now.',
  rupees: 'About Rs {rupees}',
  headline: {
    salon: { real: '{count} customers have not been back in 60 days.', zero: 'Nobody has gone quiet for 60 days. Good.', sample: 'Sample: {count} customers would be due back.', money: 'About Rs {rupees} of visits to win back, at your average bill.' },
    mart: { real: 'Rs {rupees} is pending as udhaar from {count} customers.', zero: 'No udhaar is pending.', sample: 'Sample: Rs {rupees} of udhaar would be pending from {count} customers.', money: '' },
    dine: { real: '{count} guests have not been back in 60 days.', zero: 'Nobody has gone quiet for 60 days. Good.', sample: 'Sample: {count} guests would be due back.', money: 'About Rs {rupees} of visits to win back, at your average bill.' },
    cloth: { real: '{count} items have not sold in 90 days.', zero: 'Every item has sold in the last 90 days. Good.', sample: 'Sample: {count} items would be slow movers.', money: 'They hold about Rs {rupees} of stock at cost.' },
    wash: { real: '{count} vehicles have not been back in 30 days.', zero: 'Every vehicle was washed in the last 30 days. Good.', sample: 'Sample: {count} vehicles would be due back.', money: 'About Rs {rupees} of washes to win back, at your average job.' },
  },
  steps: {
    prices_set: 'Set your prices', staff_ready: 'Add your team', first_bill: 'Make your first bill', suggestion_viewed: 'Look at today\'s three suggestions',
    booking_link_shared: 'Share your booking link', items_added: 'Add your items', day_closed: 'Close your first day', staff_added: 'Add your staff',
    menu_added: 'Add your menu', first_order_paid: 'Take your first order', qr_menu_shared: 'Share your QR menu', variants_added: 'Add your stock (sizes and colours)',
    price_list_set: 'Set your price list', attendant_added: 'Add your attendants', first_job: 'Make your first job',
  },
  next: 'Next step',
  done: 'Done', todo: 'To do', markDone: 'Mark as done',
  allDone: 'Set-up complete. Check the three suggestions each morning.',
  sampleLoaded: 'Sample data added. It is marked "(Sample)" and you can remove it in one tap.',
  sampleRemoved: 'Sample data removed.',
  sampleHasRealData: 'You already have your own records, so sample data is not needed.',
  sampleAlready: 'Sample data is already on.',
};
const ta = {
  sampleLabel: 'இவை மாதிரி எண்கள், உங்கள் தகவல் இன்னும் இல்லை. உங்கள் பதிவுகளைச் சேர்க்கலாம், அல்லது பார்க்க மாதிரி தகவலை ஏற்றலாம். ஒரே தட்டலில் நீக்கலாம்.',
  sampleOnNote: 'மாதிரி தகவல் இயங்குகிறது. நீக்கும் வரை அறிக்கைகளில் அது சேரும்.',
  nothing: 'இப்போது உங்கள் பதிவுகளில் வழக்கத்திற்கு மாறாக எதுவும் இல்லை.',
  headline: {
    salon: { real: '{count} வாடிக்கையாளர்கள் 60 நாட்களாக வரவில்லை.', zero: '60 நாட்களாக யாரும் வராமல் இல்லை. நல்லது.', sample: 'மாதிரி: {count} வாடிக்கையாளர்கள் திரும்ப வர வேண்டியவர்கள்.', money: 'உங்கள் சராசரி பில்லில் சுமார் ரூ {rupees} மீட்கலாம்.' },
    mart: { real: '{count} வாடிக்கையாளர்களிடம் ரூ {rupees} உதாரி நிலுவை உள்ளது.', zero: 'உதாரி நிலுவை எதுவும் இல்லை.', sample: 'மாதிரி: {count} வாடிக்கையாளர்களிடம் ரூ {rupees} நிலுவை இருக்கும்.', money: '' },
    dine: { real: '{count} விருந்தினர்கள் 60 நாட்களாக வரவில்லை.', zero: '60 நாட்களாக யாரும் வராமல் இல்லை. நல்லது.', sample: 'மாதிரி: {count} விருந்தினர்கள் திரும்ப வர வேண்டியவர்கள்.', money: 'உங்கள் சராசரி பில்லில் சுமார் ரூ {rupees} மீட்கலாம்.' },
    cloth: { real: '{count} பொருட்கள் 90 நாட்களாக விற்கவில்லை.', zero: 'எல்லா பொருட்களும் கடந்த 90 நாட்களில் விற்றுள்ளன. நல்லது.', sample: 'மாதிரி: {count} பொருட்கள் மெதுவாக விற்பவை.', money: 'அவற்றில் செலவு விலையில் சுமார் ரூ {rupees} சரக்கு உள்ளது.' },
    wash: { real: '{count} வாகனங்கள் 30 நாட்களாக வரவில்லை.', zero: 'எல்லா வாகனங்களும் கடந்த 30 நாட்களில் கழுவப்பட்டன. நல்லது.', sample: 'மாதிரி: {count} வாகனங்கள் திரும்ப வர வேண்டியவை.', money: 'உங்கள் சராசரி வேலையில் சுமார் ரூ {rupees} மீட்கலாம்.' },
  },
  steps: {
    prices_set: 'விலைகளை அமைக்கவும்', staff_ready: 'உங்கள் குழுவைச் சேர்க்கவும்', first_bill: 'முதல் பில் போடவும்', suggestion_viewed: 'இன்றைய மூன்று பரிந்துரைகளைப் பார்க்கவும்',
    booking_link_shared: 'முன்பதிவு இணைப்பைப் பகிரவும்', items_added: 'பொருட்களைச் சேர்க்கவும்', day_closed: 'முதல் நாளை முடிக்கவும்', staff_added: 'பணியாளர்களைச் சேர்க்கவும்',
    menu_added: 'மெனுவைச் சேர்க்கவும்', first_order_paid: 'முதல் ஆர்டரை எடுக்கவும்', qr_menu_shared: 'QR மெனுவைப் பகிரவும்', variants_added: 'சரக்கைச் சேர்க்கவும் (அளவு, நிறம்)',
    price_list_set: 'விலைப்பட்டியலை அமைக்கவும்', attendant_added: 'பணியாளர்களைச் சேர்க்கவும்', first_job: 'முதல் வேலையைப் பதிவு செய்யவும்',
  },
  next: 'அடுத்த படி', done: 'முடிந்தது', todo: 'செய்ய வேண்டும்', markDone: 'முடிந்தது என்று குறிக்கவும்',
  allDone: 'அமைப்பு முடிந்தது. தினமும் காலை மூன்று பரிந்துரைகளைப் பாருங்கள்.',
  sampleLoaded: 'மாதிரி தகவல் சேர்க்கப்பட்டது. "(Sample)" என்று குறிக்கப்பட்டுள்ளது, ஒரே தட்டலில் நீக்கலாம்.',
  sampleRemoved: 'மாதிரி தகவல் நீக்கப்பட்டது.',
  sampleHasRealData: 'உங்களிடம் ஏற்கனவே சொந்த பதிவுகள் உள்ளன, எனவே மாதிரி தகவல் தேவையில்லை.',
  sampleAlready: 'மாதிரி தகவல் ஏற்கனவே உள்ளது.',
};
const LANGS = { en, ta };
const get = (obj, path) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? String(vars[k]) : ''));
// t('headline.salon.real', { count: 4 }, 'ta'): Tamil if there is a line for it, otherwise English.
const t = (key, vars, lang) => { const v = get(LANGS[lang] || en, key); return fill(v == null ? (get(en, key) == null ? key : get(en, key)) : v, vars); };
const norm = (lang) => (lang === 'ta' ? 'ta' : 'en');
const inr = (n) => Number(n).toLocaleString('en-IN');
module.exports = { en, ta, t, norm, fill, inr, LANGS };
