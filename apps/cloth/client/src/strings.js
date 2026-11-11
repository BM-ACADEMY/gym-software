// All wording for the Cloth screens, in one place (English). Tamil and Hindi are not added yet.
export default {
  tabs: { panel: 'Panel', bill: 'Bill', alterations: 'Alterations', stock: 'Stock', people: 'Customers', items: 'Other items' },
  common: { loading: 'Loading...', retry: 'Try again', save: 'Save', cancel: 'Cancel', back: 'Back', search: 'Search', none: 'Nothing here yet.', rs: 'Rs', failed: 'Could not do that.' },
  bill: {
    title: 'New bill', scan: 'Barcode', scanGo: 'Add', scanHint: 'Scan or type the code on the label', find: 'Find an item', pickSize: 'Size', pickColour: 'Colour',
    qty: 'Pieces', metres: 'Metres (up to 2 decimals)', staff: 'Sold by', pickStaff: 'Choose staff', discount: 'Discount', discPercent: '% off', discAmount: 'Rs off', discReason: 'Reason for the discount (needed)',
    billDiscount: 'Discount on the whole bill', customer: 'Customer phone (optional)', customerFound: 'Customer', tax: 'GST on the bill', taxNone: 'No GST', taxExcl: 'GST added on top', taxIncl: 'Price already has GST',
    pay: 'Payment', cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Pay later', total: 'Total', remaining: 'Still to pay', change: 'Change', save: 'Save bill', saved: 'Bill saved', noLines: 'Add at least one item.', needStaff: 'Choose who sold each item.',
    needReason: 'Write the reason for the discount.', stockLeft: 'In stock', outOfStock: 'Out of stock', newBill: 'Start a new bill', remove: 'Remove',
  },
  alter: {
    title: 'Alteration jobs', add: 'New job', what: 'What is the work?', name: 'Customer name', phone: 'Phone', ready: 'Ready on', charge: 'Charge (Rs)', advance: 'Advance paid (Rs)', note: 'Note',
    all: 'All', overdue: 'Late', uncollected: 'Ready, not collected', status: { received: 'Received', in_progress: 'In progress', ready: 'Ready', delivered: 'Delivered', cancelled: 'Cancelled' },
    move: 'Move to', link: 'Pickup link', rotate: 'Make a new link', linkNote: 'Give the customer this link. It shows only the item, status, ready date and balance.', created: 'Job saved',
  },
  stock: {
    title: 'Stock', count: 'Count', counted: 'Counted', expected: 'System stock', difference: 'Difference', adjust: 'Also set the system stock to my count (owner only)', reason: 'Note', saveCount: 'Save count', mismatch: 'Counts that did not match (last 30 days)',
    returns: 'Return or exchange', billId: 'Bill (choose from the list)', kind: 'Kind', ret: 'Return', exch: 'Exchange', items: 'Items coming back', reasonReturn: 'Reason (needed)', doReturn: 'Put the stock back', returnDone: 'Stock put back', moneyNote: 'Now refund the money with Return on the bill, so points and pay-later are reversed too.',
    recentBills: 'Recent bills', metre: 'metres', piece: 'pieces',
  },
  people: {
    title: 'Customers', find: 'Name or phone', points: 'Loyalty points', import: 'Import customers from a file', paste: 'Paste the CSV here (first row: column names)', preview: 'Check the file', commit: 'Add these customers', willAdd: 'Will add', added: 'Added', skipped: 'Skipped', errors: 'Problems', columns: 'Columns read',
    pickFile: 'Choose a CSV file', noSelect: 'Tap a customer to see points.',
  },
};
