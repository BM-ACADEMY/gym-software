'use strict';
// AP-02 (gym): marketing ideas for the owner. Pure rules, no database, no AI, no sending.
// Every idea is a draft the owner copies and posts or sends herself/himself: level is always "suggest".
// Sending to members stays with the existing, consent-checked renewal flow.
// Ready drafts in Tamil and Hindi (AI-08). Fixed text, no AI cost. Native-speaker review is pending (same as the other ta/hi lines).
const LOCAL = {
  trial_offer: { ta: 'இந்த வாரம் உங்கள் நண்பரை அழைத்து வாருங்கள். எங்கள் ஜிம்மில் ஒரு நாள் இலவச டிரையல்! நேரத்தை பதிவு செய்ய எங்களுக்கு செய்தி அனுப்புங்கள்.', hi: 'इस हफ्ते अपने दोस्त को लाइए। हमारे जिम में एक दिन का फ्री ट्रायल! स्लॉट बुक करने के लिए हमें मैसेज करें।' },
  attendance_challenge: { ta: '7 நாள் சவால்: இந்த வாரம் 5 நாள் வாருங்கள், சிறிய பரிசு பெறுங்கள். தொடங்கும்போது பயிற்சியாளரிடம் சொல்லுங்கள்.', hi: '7 दिन की चुनौती: इस हफ्ते 5 दिन आइए और छोटा तोहफा पाइए। शुरू करते समय ट्रेनर को बताएं।' },
  early_renewal: { ta: 'உங்கள் திட்டம் முடியும் முன் புதுப்பித்தால் ஒரு வாரம் கூடுதல் இலவசம். கவுண்டரில் கேளுங்கள்.', hi: 'प्लान खत्म होने से पहले रिन्यू करें और एक हफ्ता एक्स्ट्रा पाएं। काउंटर पर पूछें।' },
  weekend_post: { ta: 'இந்த மாதம் இலக்கை அடைந்த எங்கள் உறுப்பினரை சந்திக்கவும். படம் அல்லது பெயரை போடும் முன் அவர் அனுமதி பெறுங்கள்.', hi: 'इस महीने लक्ष्य पाने वाले हमारे सदस्य से मिलिए। फोटो या नाम डालने से पहले उनसे अनुमति लें।' },
};
const fmt = (n) => Number(n).toLocaleString('en-IN');

// stats: from aiAssist.gatherStats. fee: monthly fee from ownerCoachRules.monthlyFee (or null). now: Date.
function buildIdeas(stats, fee, now = new Date(), lang = 'en') {
  if (!stats) return []; const s = stats; const ideas = [];
  const dow = new Date(now.getTime() + 5.5 * 3600000).getUTCDay(); // 0 Sunday .. 6 Saturday, IST
  if ((s.newMembers7 || 0) <= 1) ideas.push({ kind: 'trial_offer', title: 'Invite friends for a free trial day', why: `Only ${s.newMembers7 || 0} new member(s) joined this week.`,
    draft: 'This week, bring a friend for a FREE trial day at our gym. Message us to book your slot.' });
  if ((s.activeMembers || 0) >= 20 && (s.checkinsThisWeek || 0) < (s.checkinsLastWeek || 0) * 0.8) ideas.push({ kind: 'attendance_challenge', title: 'Run a 7-day attendance challenge', why: `Check-ins dropped from ${s.checkinsLastWeek} to ${s.checkinsThisWeek}.`,
    draft: '7-day challenge: come 5 days this week and get a small gift from us. Tell the trainer when you start.' });
  if ((s.expiring7 || 0) >= 5) ideas.push({ kind: 'early_renewal', title: 'Early-renewal thank-you offer', why: `${s.expiring7} memberships end in the next 7 days.`,
    draft: 'Renew before your plan ends and get a thank-you extra week. Ask at the desk.' + (fee ? ` (Cost to you if all take it: about Rs ${fmt(Math.round(fee * s.expiring7 / 4))}. Check before you offer.)` : '') });
  if (dow === 0 || dow === 6) ideas.push({ kind: 'weekend_post', title: 'Post a member success story', why: 'Weekend posts get seen more.', draft: 'Meet one of our members who reached a goal this month. Ask their permission before you post a photo or name.' });
  return ideas.slice(0, 3).map((i) => ({ ...i, draft: (LOCAL[i.kind] && LOCAL[i.kind][lang]) || i.draft, level: 'suggest', currency: 'INR' }));
}
module.exports = { buildIdeas };
