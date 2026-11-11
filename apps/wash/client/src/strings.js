// All wording for the Wash screens, in English, in one place (Tamil and Hindi come later, after a native speaker's review, M-06).
export default {
  tabs: { board: 'Jobs', newJob: 'New job', dues: 'Dues', close: 'Close the day', panel: 'Panel' },
  states: { waiting: 'Waiting', washing: 'Washing', ready: 'Ready', delivered: 'Delivered today' },
  board: {
    empty: 'No jobs here.', refresh: 'Refresh', attendant: 'Who is washing it?', choose: 'Choose', start: 'Start washing', ready: 'Mark ready', deliver: 'Deliver',
    cancel: 'Cancel job', cancelWhy: 'Why is it being cancelled?', cancelDo: 'Cancel this job', keep: 'Keep the job', queue: 'in queue', wash: 'in wash', since: 'ready for',
    mins: 'min', payNow: 'Paid in full', payHow: 'How did they pay?', cash: 'Cash', upi: 'UPI', card: 'Card', payLater: 'Pay later', payLaterHelp: 'Needs the customer phone number saved on the vehicle. It goes on the Dues list.',
    ownerTold: 'The owner is told about every job cancelled after washing began.', passCovered: 'Covered by monthly pass', toPay: 'To pay', discount: 'Discount',
    photos: 'Photos', photoHelp: 'Photos are kept as a reference only. Compress each to about 300 KB first. Uploading the picture itself is not available yet.',
    before: 'Before', after: 'After', ref: 'Photo reference', bytes: 'Size in KB', addPhoto: 'Save photo reference', noPhotos: 'No photos yet.',
    refund: 'Refund', refundHelp: 'Only the owner can refund. A reason is needed. You cannot refund more than was paid.', amount: 'Amount in rupees', reason: 'Reason', doRefund: 'Refund', ownerOnly: 'Only the owner can give a refund.',
  },
  cancelReasons: ['Customer left before the wash finished', 'Problem found with the vehicle', 'Cancelled after washing began, other reason'],
  job: {
    plate: 'Number plate', find: 'Find vehicle', newVehicle: 'New vehicle: choose the class and save it', klass: 'Vehicle class', owner: 'Owner name', phone: 'Owner mobile (10 digits)', save: 'Save vehicle',
    passLeft: 'Monthly pass: washes left', passNone: 'No active monthly pass', passUsed: 'This job will use one wash from the pass.', lastWash: 'Last wash', addons: 'Extras', create: 'Create job card',
    withDiscount: 'Give a discount', type: 'Type', amount: 'Rupees', percent: 'Percent', value: 'Value', why: 'Reason for the discount (needed)', total: 'Price', created: 'Job created. It is on the board under Waiting.',
    classes: { bike: 'Bike', hatchback: 'Hatchback', sedan: 'Sedan', suv: 'SUV', other: 'Other' }, noPrice: 'No price set for this class. The owner sets prices in the panel.',
  },
  dues: { title: 'Customers who still owe', none: 'Nobody owes anything.', total: 'Total owed', collect: 'Collect', how: 'How did they pay?', amount: 'Amount in rupees', note: 'Note', collected: 'Collected' },
  close: {
    title: 'Close the day', help: 'Count the cash in the drawer and type it in. The app shows what it expected. A difference is shown to the owner, not hidden.', opening: 'Cash in the drawer at the start (rupees)', declared: 'Cash you counted now (rupees)',
    closeBtn: 'Close the day', done: 'Day closed', expected: 'Expected cash', counted: 'Counted', diff: 'Difference', flag: 'Check', history: 'Last closings', none: 'No closings yet.',
  },
  common: { loading: 'Loading...', retry: 'Try again', rupee: 'Rs', back: 'Back', close: 'Close', saved: 'Saved' },
};
