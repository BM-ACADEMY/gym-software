'use strict';
// DRAFT templates for a business to its own customers or candidates (B2C), one small set per product. NOT submitted to Meta.
// Needs, before submission: the number and provider decision, Tamil/Hindi versions, and Kamar's wording check.
// Rules kept here: only for people who agreed to be contacted; no discount, offer or guarantee wording; utility first.
const TEMPLATES = {
  groom_appointment_reminder: { category: 'UTILITY', params: ['name', 'salon', 'when', 'phone'], sample: ['Priya', 'Glow Salon', 'Friday 4 pm', '9876543210'],
    body: 'Hi {{1}}, a reminder of your visit at {{2}} on {{3}}. Need to change it? Call {{4}}.' },
  groom_come_back: { category: 'MARKETING', params: ['name', 'salon', 'phone'], sample: ['Priya', 'Glow Salon', '9876543210'],
    body: 'Hi {{1}}, it has been a while since your last visit to {{2}}. Call {{3}} to book a time that suits you.' },
  mart_dues_reminder: { category: 'UTILITY', params: ['name', 'shop', 'amount', 'phone'], sample: ['Ravi', 'Kumar Stores', '450', '9876543210'],
    body: 'Hi {{1}}, a payment of Rs {{3}} is pending at {{2}}. Already paid? Please ignore this. Questions? Call {{4}}.' },
  mart_bill_copy: { category: 'UTILITY', params: ['name', 'shop', 'bill_no', 'amount'], sample: ['Ravi', 'Kumar Stores', 'B-1042', '450'],
    body: 'Hi {{1}}, thank you for shopping at {{2}}. Your bill {{3}} is Rs {{4}}.' },
  dine_order_ready: { category: 'UTILITY', params: ['name', 'venue', 'order_no'], sample: ['Ravi', 'Spice Corner', 'D-18'],
    body: 'Hi {{1}}, your order {{3}} at {{2}} is ready for pickup.' },
  dine_booking_confirm: { category: 'UTILITY', params: ['name', 'venue', 'when', 'people', 'phone'], sample: ['Ravi', 'Spice Corner', 'Saturday 8 pm', '4', '9876543210'],
    body: 'Hi {{1}}, your table for {{4}} at {{2}} is booked for {{3}}. To change it, call {{5}}.' },
  cloth_dues_reminder: { category: 'UTILITY', params: ['name', 'shop', 'amount', 'phone'], sample: ['Meena', 'Style House', '1200', '9876543210'],
    body: 'Hi {{1}}, a payment of Rs {{3}} is pending at {{2}}. Already paid? Please ignore this. Questions? Call {{4}}.' },
  cloth_alteration_ready: { category: 'UTILITY', params: ['name', 'shop', 'item'], sample: ['Meena', 'Style House', 'blouse'],
    body: 'Hi {{1}}, your {{3}} at {{2}} is ready for pickup.' },
  wash_ready_for_pickup: { category: 'UTILITY', params: ['name', 'business', 'vehicle'], sample: ['Ravi', 'Shine Wash', 'TN 01 AB 1234'],
    body: 'Hi {{1}}, your vehicle {{3}} is ready at {{2}}.' },
  wash_come_back: { category: 'MARKETING', params: ['name', 'business', 'phone'], sample: ['Ravi', 'Shine Wash', '9876543210'],
    body: 'Hi {{1}}, it has been a while since your last wash at {{2}}. Call {{3}} to book a time that suits you.' },
  hire_interview_reminder: { category: 'UTILITY', params: ['name', 'agency', 'role', 'when', 'phone'], sample: ['Anita', 'Prime Staffing', 'Accountant', 'Monday 11 am', '9876543210'],
    body: 'Hi {{1}}, a reminder of your interview for {{3}} with {{2}} on {{4}}. To reschedule, call {{5}}.' },
  hire_joining_reminder: { category: 'UTILITY', params: ['name', 'agency', 'role', 'date', 'phone'], sample: ['Anita', 'Prime Staffing', 'Accountant', '1 Dec 2026', '9876543210'],
    body: 'Hi {{1}}, a reminder that you join as {{3}} on {{4}}. Questions? Call {{5}} at {{2}}.' },
};
module.exports = { TEMPLATES };
