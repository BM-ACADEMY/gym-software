'use strict';
// D-28: the standard site wording. The owner can change it in Root Admin > Site content; these stay as the safe fallback.
// Only say what is built (docs/MARKETING_CLAIMS.md). {trialDays} is replaced with the live trial length when the page is read.
module.exports = {
 "pricing": {
  "headline": "Simple pricing. Start free for {trialDays} days.",
  "subline": "No card needed. No setup fee. Pay in advance, no auto-renewal."
 },
 "landing": {
  "badge": "Gym Management Software Made in India",
  "line1": "Gym management",
  "line2": "software for",
  "line3": "fitness industry",
  "subline": "Run members, payments and attendance, send WhatsApp reminders automatically, and get AI plans and weekly insights. Made for gyms in India."
 },
 "faq": [
  {
   "id": "what",
   "q": "What is GymDesk?",
   "a": "GymDesk is web-based software for running a gym: members, plans, payments and dues, attendance, trainers, and WhatsApp reminders. You use it in a browser on a phone or computer."
  },
  {
   "id": "trial",
   "q": "Is there a free trial?",
   "a": "Yes. {trialDays} days with Growth plan features, no card needed. After that the account becomes read-only until you choose a plan."
  },
  {
   "id": "plan",
   "q": "Which plan is right for my gym?",
   "a": "Solo for up to 50 members, Starter up to 150, Growth up to 500, Pro for bigger gyms. You can upgrade any time and the unused value of your current plan is credited."
  },
  {
   "id": "renew",
   "q": "Does it renew automatically?",
   "a": "No. You pay for a month or a year in advance. We remind you before it ends and you pay again to continue. Nothing is charged without you paying."
  },
  {
   "id": "gst",
   "q": "Do I get a GST invoice?",
   "a": "Yes, for every payment. Gyms in Puducherry see CGST and SGST; other states see IGST."
  },
  {
   "id": "import",
   "q": "Can I move my existing members in?",
   "a": "Yes. Upload an Excel or CSV file. You see a preview and any errors before anything is saved."
  },
  {
   "id": "machines",
   "q": "Does it work with fingerprint or face machines?",
   "a": "You can import the attendance log from any brand as an Excel or CSV file. Live sync with machines is planned for later and is not available yet."
  },
  {
   "id": "whatsapp",
   "q": "What WhatsApp messages are sent?",
   "a": "Renewal reminders, weekly dues reminders, a check-in after 10 days of absence, and a daily summary for the owner. You can turn each off. Solo has no WhatsApp messages; other plans include a monthly allowance."
  },
  {
   "id": "aisend",
   "q": "Does the AI send messages to my members?",
   "a": "No. WhatsApp messages use fixed, approved wording. The AI does not write or send messages to your members by itself."
  },
  {
   "id": "aidata",
   "q": "Are my members names and phone numbers sent to the AI?",
   "a": "Not for the weekly summary or the Ask GymDesk help assistant. AI workout and diet plans do use the member goal, equipment and health notes you enter, and a trainer or owner reviews a plan before it is shared. A plan is a starting point, not medical advice."
  },
  {
   "id": "stop",
   "q": "What if I stop paying?",
   "a": "You get 3 days of full access after the end date. After that the account is read-only: you can still see and export your data, but you cannot add new records until you choose a plan."
  },
  {
   "id": "app",
   "q": "Is there a mobile app?",
   "a": "Members use a web portal on their phone browser. There is no iOS or Android app in the stores yet."
  },
  {
   "id": "lang",
   "q": "Which languages are supported?",
   "a": "English, Tamil and Hindi menus are available now, with more screens being translated."
  },
  {
   "id": "safe",
   "q": "How safe is my data?",
   "a": "Each gym data is kept separate, connections are encrypted and passwords are stored hashed. You can export your data."
  },
  {
   "id": "support",
   "q": "How do I get help?",
   "a": "Use the Help centre, or raise a request from Help & Support inside the app. We reply by email."
  }
 ],
 "help": [
  {
   "id": "start",
   "q": "How do I get started?",
   "a": [
    "Sign up with your email and password. You get a {trialDays}-day free trial with Growth features, no card needed.",
    "Follow the checklist on your dashboard: add your gym details, import or add members, set up plans, and turn on WhatsApp reminders."
   ]
  },
  {
   "id": "import",
   "q": "How do I bring in my existing members?",
   "a": [
    "Go to Import Members. Upload an Excel or CSV file with name, phone, plan and expiry date columns.",
    "You see a preview with any errors first. Nothing is saved until you confirm. Up to 2,000 rows at a time."
   ]
  },
  {
   "id": "dates",
   "q": "My member import shows wrong dates",
   "a": [
    "Write dates as day-month-year, for example 25-12-2026. Excel date cells also work.",
    "If a row is marked as an error, fix that row in your file and upload again."
   ]
  },
  {
   "id": "biometric",
   "q": "Can I use my fingerprint or face machine?",
   "a": [
    "Yes, by importing its log file. Export the attendance log from your machine as Excel or CSV and upload it in Import Device Log.",
    "First give each member the same ID number the machine uses (Device ID on the member form). Unmatched IDs are listed so you can fix them. Live sync with machines is not available yet."
   ]
  },
  {
   "id": "qr",
   "q": "How does QR check-in work?",
   "a": [
    "Each member has a QR code in their member portal. Scan it at the front desk from the Attendance page.",
    "The QR is signed, so a screenshot of someone else's old code or a made-up code is refused."
   ]
  },
  {
   "id": "whatsapp",
   "q": "Which WhatsApp messages are sent?",
   "a": [
    "Renewal reminders (30, 7 and 1 day before expiry, and after it ends), weekly dues reminders, a check-in after 10 days of absence, and a daily summary for you at 8 pm.",
    "Members get messages only between 9 am and 9 pm. You can switch each type off in Settings. Each plan has a monthly message allowance."
   ]
  },
  {
   "id": "optin",
   "q": "Do my members have to agree to WhatsApp messages?",
   "a": [
    "Yes. You must have your members' permission. Tick the confirmation in Settings, and keep a record. A member can ask you to stop; turn off messages for that member on their profile."
   ]
  },
  {
   "id": "pay",
   "q": "How do I pay and renew?",
   "a": [
    "Go to Plan & Billing, pick a plan and month or year, and pay through Razorpay (UPI, cards, net banking).",
    "Plans are prepaid and do not renew by themselves. We remind you before the end date. Paying early adds time to your current end date."
   ]
  },
  {
   "id": "gst",
   "q": "Where is my GST invoice?",
   "a": [
    "Plan & Billing lists every payment with a Download invoice button.",
    "Set your state in Plan & Billing first. Puducherry gyms get CGST + SGST, other states get IGST."
   ]
  },
  {
   "id": "upgrade",
   "q": "Can I upgrade or downgrade?",
   "a": [
    "Upgrade any time. The unused value of your current plan is credited.",
    "Downgrade takes effect when your current paid period ends."
   ]
  },
  {
   "id": "expired",
   "q": "My plan ended. What happens to my data?",
   "a": [
    "You get 3 days of full access after the end date. After that your account is read-only: you can see and export your data, but cannot add or change anything until you pay.",
    "Your data is not deleted."
   ]
  },
  {
   "id": "staff",
   "q": "How do I add staff and limit what they see?",
   "a": [
    "Open Sub-Admin / Staff, add the person and tick the screens they may use. Solo allows 1 staff login, Starter 2, Growth 5, Pro unlimited."
   ]
  },
  {
   "id": "password",
   "q": "I forgot my password",
   "a": [
    "Use Forgot password on the sign-in page. If that does not work, contact support from the Contact page."
   ]
  }
 ]
};
