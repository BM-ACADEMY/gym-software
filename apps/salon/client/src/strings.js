// All English wording for the Salon screens lives here (one place, so a native speaker can review it).
// Tamil text is a draft for the few labels below and still needs a native speaker's check (M-06). Anything missing falls back to English.
// Clinic businesses get Patient / Doctor wording through `words(preset)` below; no prices or claims text here.
export const EN = {
  tabs: { day: 'Day', queue: 'Walk-ins', bill: 'Bill', people: 'Customers', panel: 'Owner panel' },
  common: { loading: 'Loading…', retry: 'Try again', close: 'Close', save: 'Save', cancel: 'Cancel', back: 'Back', add: 'Add', search: 'Search', none: 'Nothing here yet.' },
  day: { title: 'Appointments', date: 'Day', all: 'Everyone', free: 'Free times', pickService: 'Choose a service', pickStaff: 'Choose who', pickTime: 'Choose a time', noSlots: 'No free time on this day.', book: 'Book', name: 'Name', phone: 'Mobile number (10 digits)', consent: 'The customer agrees to us keeping their details to manage visits', done: 'Done', noshow: 'No-show', cancelVisit: 'Cancel visit', move: 'Move', moveTo: 'Move to', accept: 'Accept', waiting: 'Waiting for you to accept', booked: 'Booked', status: { booked: 'Booked', pending: 'Waiting', done: 'Done', noshow: 'No-show', cancelled: 'Cancelled' }, list: 'List', grid: 'Time grid', gridHint: 'Tap an empty box to book that person.', area: 'Problem area', areas: { foot: 'Foot and ankle', knee: 'Knee', hip: 'Hip', spine: 'Spine and back', rehab: 'Rehab', other: 'Other' } },
  queue: { title: 'Walk-ins today', add: 'Add walk-in', name: 'Name', phone: 'Mobile (optional)', service: 'Service (optional)', waiting: 'Waiting', serving: 'Serving', start: 'Start', finish: 'Finished', left: 'Left' },
  bill: { title: 'New bill', addLine: 'Add a service', service: 'Service', staff: 'Done by', qty: 'Qty', remove: 'Remove', discount: 'Discount', discountType: 'Type', percent: 'Percent', rupees: 'Rupees', reason: 'Reason for the discount', reasonHint: 'A discount needs a reason (3 letters or more).', payments: 'Payment', cash: 'Cash', upi: 'UPI', card: 'Card', amount: 'Amount', addPayment: 'Add payment', total: 'Total', received: 'Received', change: 'Change to give back', due: 'Still to pay', save: 'Save bill', saved: 'Bill saved', number: 'Bill number', newBill: 'New bill', customer: 'Customer (optional)', gstNote: 'GST or plain bill follows your business setting.', needLine: 'Add at least one service.', needStaff: 'Choose who did each service.', noCustomer: 'No customer (walk-in)', findCustomer: 'Search name or number', newCustomer: 'New customer', chosen: 'Customer', change: 'Change', addProduct: 'Add a product', product: 'Product', inStock: 'in stock', customerName: 'Name', customerPhone: 'Mobile (10 digits)', customerConsent: 'The customer agrees to us keeping their details', saveCustomer: 'Save customer', print: 'Print bill', printA4: 'Print A4', copyText: 'Copy bill message', copied: 'Copied. Paste it in WhatsApp.', printFail: 'Could not open the bill.' },
  people: { title: 'Customers', search: 'Search name or number', visits: 'Visits', note: 'Note', empty: 'No customers found.', masked: 'Number is hidden for staff logins.', birthday: 'Birthday', lastVisit: 'Last visit' },
  words: {
    default: { staff: 'Staff', customer: 'Customer', customers: 'Customers', visit: 'visit' },
    clinic: { staff: 'Doctor', customer: 'Patient', customers: 'Patients', visit: 'appointment' },
  },
};
export const TA = {
  tabs: { day: 'நாள்', queue: 'நேரடி வருகை', bill: 'பில்', people: 'வாடிக்கையாளர்கள்', panel: 'உரிமையாளர் பக்கம்' },
  common: { loading: 'ஏற்றுகிறது…', save: 'சேமி', cancel: 'ரத்து', back: 'பின்', add: 'சேர்', search: 'தேடு' },
  day: { title: 'நேரங்கள்', book: 'பதிவு செய்', name: 'பெயர்', done: 'முடிந்தது', noshow: 'வரவில்லை', cancelVisit: 'நேரத்தை ரத்து செய்' },
  bill: { title: 'புதிய பில்', total: 'மொத்தம்', save: 'பில்லைச் சேமி', cash: 'ரொக்கம்', upi: 'UPI', card: 'கார்டு' },
};
const deep = (a, b) => { const o = { ...a }; for (const k of Object.keys(b || {})) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deep(a[k] || {}, b[k]) : b[k]; return o; };
export const textFor = (lang) => (lang === 'ta' ? deep(EN, TA) : EN);
export const wordsFor = (preset, t = EN) => (preset === 'clinic' ? t.words.clinic : t.words.default);
