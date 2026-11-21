import LegalLayout from '../../components/public/LegalLayout';
import Section, { DraftNotice } from '../../components/public/LegalSection';
import { company } from '../../config/company';

const Privacy = () => (
  <LegalLayout title="Privacy Policy">
    <DraftNotice />
    <p className="text-gray-500 text-sm mb-8 bg-teal-50 border border-teal-100 rounded-xl p-4">
      This explains what {company.legalName} ("we") collects when you use {company.product}, why, and what your choices are. It is written with India's Digital Personal Data Protection Act, 2023 in mind.
    </p>

    <Section title="Two roles">
      <p><strong>Gym owners (our customers):</strong> we are the data fiduciary for your account details: your name, email, phone, gym details, GST details and payment history with us.</p>
      <p><strong>Gym members:</strong> when a gym enters its members into {company.product}, the gym decides what to collect and why, and we process that data on the gym's behalf. If you are a member and want to see, correct or delete your data, ask your gym first. We will help the gym act on your request.</p>
    </Section>

    <Section title="What we collect">
      <ul className="list-disc pl-5 space-y-1 text-gray-500">
        <li>Account: name, email, phone, password (stored only as a hash), gym name, state, GST number if given.</li>
        <li>Gym data entered by the gym: member names, phones, plans, payments, attendance, workout and diet plans, and staff details.</li>
        <li>Billing with us: plan, amount, GST invoice details, Razorpay payment reference. We never see your card or bank number.</li>
        <li>Messages: records of WhatsApp messages sent on a gym's behalf and whether they were delivered.</li>
        <li>Technical: IP address, browser, and basic logs for security and fixing faults.</li>
      </ul>
    </Section>

    <Section title="Why we use it">
      <ul className="list-disc pl-5 space-y-1 text-gray-500">
        <li>To run the service: sign-in, memberships, attendance, reminders, invoices.</li>
        <li>To take payment and issue GST invoices, and meet tax and legal duties.</li>
        <li>To keep the service secure and prevent fraud.</li>
        <li>To answer support requests and tell you about your plan and renewals.</li>
      </ul>
      <p>We do not sell personal data and we do not use members' data for advertising.</p>
    </Section>

    <Section title="WhatsApp">
      <p>Gym reminders are sent through the WhatsApp Business Platform (Meta). A member's phone number and the message text are shared with WhatsApp to deliver it. A gym must have the member's permission; members can tell their gym to stop.</p>
    </Section>

    <Section title="Who else sees it">
      <p>Service providers that help us run {company.product}: cloud hosting and database, Razorpay for payments, WhatsApp for messages, and an AI service (OpenAI). It receives: the goal, equipment and any health notes entered for a member when a gym generates a workout or diet plan; the text of a question typed into Ask GymDesk; and weekly totals (counts and rupee amounts, no names or phone numbers) for the dashboard summary. We share data with authorities only when the law requires it.</p>
    </Section>

    <Section title="Keeping and deleting">
      <p>We keep data while the account is active. Tax records such as invoices are kept as long as the law requires. A gym can ask us to delete its account and data; after that we remove it from live systems and it leaves backups within a limited period.</p>
    </Section>

    <Section title="Security">
      <p>Passwords are hashed, traffic is encrypted, each gym's data is separated from other gyms, and access to production is limited. No system is perfectly secure; if a breach affects you we will tell you as the law requires.</p>
    </Section>

    <Section title="Your rights">
      <p>You can ask to access, correct or delete your personal data, to withdraw consent, and to complain. Gym owners can write to us. Members should first contact their gym.</p>
    </Section>

    <Section title="Children">
      <p>{company.product} is for business owners. A gym that registers a member under 18 is responsible for getting a parent or guardian's consent.</p>
    </Section>

    <div className="mt-10 p-6 bg-gray-50 rounded-2xl border border-gray-100">
      <h3 className="font-bold text-gray-800 mb-3">Contact</h3>
      <div className="text-sm text-gray-500 space-y-1">
        <p><strong>{company.legalName}</strong></p>
        {company.address && <p>{company.address}</p>}
        {company.email && <p>Email: <a href={`mailto:${company.email}`} className="text-teal-600 hover:underline">{company.email}</a></p>}
      </div>
    </div>
  </LegalLayout>
);

export default Privacy;
