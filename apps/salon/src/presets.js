'use strict';
// Sector presets (D-11, D-29): one appointment product, four starting points. A preset only pre-fills the list of
// services, how long each takes and how often a customer usually comes back. Prices are NOT set here: the owner
// types them. Everything below is a starting value the owner can edit (Assumption: cycles, from the master plan).
// Money everywhere in this product is whole rupees with a currency code (INR).
const CURRENCY = 'INR';
const svc = (key, name, mins, cycleDays) => ({ key, name, mins, cycleDays });
const PRESETS = {
  salon: { label: 'Salon', mode: 'appointment', staffWord: 'Stylist', customerWord: 'Customer', services: [svc('haircut', 'Haircut', 30, 42), svc('colour', 'Hair colour', 90, 56), svc('facial', 'Facial', 45, 28), svc('manicure', 'Manicure', 40, 21)] },
  spa: { label: 'Spa', mode: 'appointment', staffWord: 'Therapist', customerWord: 'Guest', services: [svc('massage60', 'Massage 60 min', 60, 21), svc('massage90', 'Massage 90 min', 90, 28), svc('bodyscrub', 'Body scrub', 60, 45)] },
  barber: { label: 'Barber', mode: 'queue', staffWord: 'Barber', customerWord: 'Customer', services: [svc('haircut', 'Haircut', 20, 28), svc('shave', 'Shave', 15, 14), svc('beard', 'Beard trim', 15, 14)] },
  clinic: { label: 'Clinic', mode: 'appointment', staffWord: 'Doctor', customerWord: 'Patient', services: [svc('consult', 'Consultation', 20, null), svc('followup', 'Follow-up', 15, null), svc('physio', 'Physiotherapy session', 45, 7)] },
};
const presetKeys = () => Object.keys(PRESETS);
// A fresh copy, so editing a business's list never changes the preset itself. Unknown preset: null.
const startingServices = (key) => (PRESETS[key] ? PRESETS[key].services.map((s) => ({ ...s, price: 0, currency: CURRENCY })) : null);
module.exports = { CURRENCY, PRESETS, presetKeys, startingServices };
