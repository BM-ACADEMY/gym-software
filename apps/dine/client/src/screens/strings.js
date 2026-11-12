// All wording for the Dine screens in one place. English is complete. Tamil lines are drafts and need a native speaker's check (M-06);
// any line missing in Tamil falls back to English. No prices, offers or claims are written here.
const en = {
  sc_back: 'Service charge back', return_restock: 'Put the ingredients back in stock (only if the food can be reused)', imp_title: 'Bring in a spreadsheet', imp_help: 'Save your sheet as CSV. Press Check first: nothing is saved until you press Save.', imp_ingredients: 'Ingredients', imp_recipes: 'Recipes', imp_guests: 'Guests', imp_file: 'Choose a CSV file', imp_paste: 'Or paste the rows here', imp_check: 'Check first', imp_save: 'Save', imp_good: 'Good rows', imp_problems: 'Problems', imp_there: 'Already there', imp_saved: 'Saved.', imp_row: 'Row', imp_big: 'The file is too big. Send fewer rows at a time.',
  tabs_tables: 'Tables', tabs_kitchen: 'Kitchen', tabs_bill: 'Bill', tabs_credit: 'Pay later', tabs_returns: 'Returns', tabs_import: 'Import', tabs_panel: 'Panel',
  loading: 'Loading…', retry: 'Try again', back: 'Back', refresh: 'Refresh', close: 'Close', save: 'Save', cancel: 'Cancel', yes: 'Yes', no: 'No',
  tables_title: 'Open tables and orders', new_order: 'New order', table_name: 'Table name or number', add_table: 'Add table', remove_table: 'Remove table', order_type: 'Type', t_dine_in: 'Dine in', t_takeaway: 'Takeaway', t_bar: 'Bar tab',
  free: 'Free', open: 'Open', sent: 'In kitchen', served: 'Served', billed: 'Billed', no_orders: 'No open orders yet. Pick a table to start one.', pub_note: 'Bar tabs and drinks with alcohol are on because pub mode is switched on in settings.',
  order: 'Order', items: 'Items', no_items: 'Nothing added yet.', add_item: 'Add', menu_search: 'Search the menu', variant: 'Size or type', extras: 'Extras', qty: 'Quantity', note_kot: 'Goes on the kitchen ticket',
  send_kot: 'Send to kitchen / bar', served_all: 'Mark all served', void: 'Remove', void_reason: 'Reason (needed once it is sent)', void_confirm: 'Remove this item', go_bill: 'Go to bill', sent_ok: 'Sent. Print the ticket if you need one.',
  print_kot: 'Print kitchen ticket', print_kot_bar: 'Print bar ticket', line_new: 'new', line_sent: 'sent', line_served: 'served',
  kitchen_title: 'Kitchen', bar_title: 'Bar', station_kitchen: 'Kitchen', station_bar: 'Bar', kitchen_empty: 'Nothing waiting.', mark_served: 'Served', auto_refresh: 'Refreshes every 10 seconds',
  bill_title: 'Bill', pick_order: 'Pick an order from Tables, then press Go to bill.', make_bill: 'Make the bill', subtotal: 'Items', discount: 'Discount', service: 'Service charge', gst: 'GST', total: 'Total to pay',
  discount_type: 'Discount type', d_percent: 'Percent', d_amount: 'Rupees', d_value: 'Discount', d_reason: 'Reason for the discount', d_limit_hint: 'The owner sets how much staff may give. A bigger discount is refused.', apply_discount: 'Make bill with discount',
  gst_note: 'The GST setting is not yet confirmed by your CA.', reopen: 'Reopen the order', reopen_reason: 'Reason to reopen', pay: 'Take payment', method: 'Method', cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Pay later', amount: 'Amount', add_payment: 'Add a payment',
  guest_name: 'Guest name', guest_phone: 'Guest mobile (10 digits)', redeem: 'Use loyalty points', paid_ok: 'Paid. Thank you.', change_due: 'Change to give back', short_by: 'Still to pay',
  split: 'Split the bill', split_equal: 'Equal', split_items: 'By items', guests: 'Number of guests', guest: 'Guest', show_split: 'Show the split', give_to: 'Who has this item',
  print_bill: 'Print bill (A5)', print_bill_a4: 'Print bill (A4)',
  credit_title: 'Pay later: who owes', credit_empty: 'Nobody owes anything.', days: 'days', owes: 'Owes', collect: 'Collect', collect_ok: 'Payment recorded.', collect_amount: 'Amount received',
  returns_title: 'Returns', returns_find: 'Paid orders', returns_pick: 'Pick a paid order to return items from.', return_reason: 'Reason for the return', return_qty: 'Return', return_go: 'Record the return', return_ok: 'Return recorded.', refund: 'Refund', returns_note: 'Service charge is not refunded here and food is not put back in stock. The owner handles those by hand.',
  not_allowed: 'Not allowed for your role.', lang: 'Language', draft_ta: 'Tamil wording is a draft and still needs a native speaker\'s check.',
};
const ta = {
  tabs_tables: 'மேசைகள்', tabs_kitchen: 'சமையலறை', tabs_bill: 'பில்', tabs_credit: 'பிறகு செலுத்துதல்', tabs_returns: 'திரும்பப் பெறுதல்', tabs_panel: 'பேனல்',
  loading: 'ஏற்றுகிறது…', retry: 'மீண்டும் முயற்சி', back: 'பின்', refresh: 'புதுப்பி', save: 'சேமி', cancel: 'ரத்து',
  tables_title: 'திறந்த மேசைகள் மற்றும் ஆர்டர்கள்', new_order: 'புதிய ஆர்டர்', table_name: 'மேசை பெயர் அல்லது எண்', t_dine_in: 'உள்ளே சாப்பிட', t_takeaway: 'பார்சல்',
  free: 'காலி', open: 'திறந்தது', sent: 'சமையலறையில்', served: 'பரிமாறப்பட்டது', billed: 'பில் போடப்பட்டது',
  send_kot: 'சமையலறைக்கு அனுப்பு', void: 'நீக்கு', go_bill: 'பில்லுக்கு செல்', kitchen_title: 'சமையலறை', kitchen_empty: 'காத்திருப்பது எதுவும் இல்லை.', mark_served: 'பரிமாறப்பட்டது',
  make_bill: 'பில் போடு', total: 'செலுத்த வேண்டிய தொகை', discount: 'தள்ளுபடி', d_reason: 'தள்ளுபடிக்கான காரணம்', pay: 'பணம் பெறு', cash: 'பணம்', upi: 'யூபிஐ', card: 'கார்டு', credit: 'பிறகு செலுத்துதல்', amount: 'தொகை', paid_ok: 'பணம் பெறப்பட்டது. நன்றி.',
  credit_title: 'பிறகு செலுத்துதல்: யார் தர வேண்டும்', credit_empty: 'யாரும் தர வேண்டியதில்லை.', collect: 'வசூலி', returns_title: 'திரும்பப் பெறுதல்', return_reason: 'திரும்பப் பெறுவதற்கான காரணம்',
  not_allowed: 'உங்கள் பொறுப்புக்கு அனுமதி இல்லை.',
};
export const LANGS = { en, ta };
export const makeT = (lang) => (k) => (LANGS[lang] && LANGS[lang][k]) || en[k] || k;
export const hasDraft = (lang) => lang !== 'en';
