import LegalLayout from '../../components/public/LegalLayout';
import Section, { DraftNotice } from '../../components/public/LegalSection';
import { company } from '../../config/company';

const Contact = () => (company.email
  ? <a href={`mailto:${company.email}`} className="text-teal-600">{company.email}</a>
  : <span>the support option inside the app</span>);

const Terms = () => (
  <LegalLayout title="Terms of Use">
    <DraftNotice />
    <p className="text-gray-500 text-sm mb-8 bg-teal-50 border border-teal-100 rounded-xl p-4">
      These terms apply to your use of {company.product}, a gym management service run by {company.legalName} ("we", "us"). By creating an account you agree to them.
    </p>

    <Section title="Who can use it">
      <p>{company.product} is for gym and fitness business owners and their staff. You must be 18 or older and able to enter a contract. You must give correct details at sign-up, including your state, because it decides the GST on your invoices.</p>
      <p>You are responsible for your password and for everything done under your account. Tell us at once if you think someone else has access.</p>
    </Section>

    <Section title="Free trial">
      <p>New accounts get a {14}-day free trial with Growth plan features. No card is needed. When the trial ends the account becomes read-only: you can still see and export your data and you can pay to continue, but you cannot add or change records until you subscribe.</p>
    </Section>

    <Section title="Plans, payment and GST">
      <p>Plans are prepaid for one month or one year. Prices on the pricing page are before GST. GST at 18% is added at checkout and shown on your invoice. If your gym is in Puducherry the invoice shows CGST and SGST; for other states it shows IGST.</p>
      <p><strong>Plans do not renew automatically.</strong> We do not store your card or set up auto-debit. Before your plan ends we send reminders, and you renew by paying again. Renewing early adds time to the end of your current period.</p>
      <p>If you upgrade during a paid period, the unused value of your current plan is credited toward the new one. Downgrades take effect when your current paid period ends.</p>
      <p>After a paid period ends you have a 3-day grace period with full access. After that the account becomes read-only until you pay.</p>
      <p>Payments are processed by Razorpay. We do not see or keep your card or bank details.</p>
    </Section>

    <Section title="Your data and your members' data">
      <p>The member records, payments and attendance you enter belong to you. You are responsible for having the right to hold that information and for using it lawfully. See our Privacy Policy for how we handle it.</p>
      <p>You can export your data while your account is active or read-only. If an account stays expired for a long time we may delete its data after giving notice to the owner's email.</p>
    </Section>

    <Section title="WhatsApp messages">
      <p>{company.product} can send WhatsApp messages (renewal reminders, dues notices, absence check-ins and an owner summary) to your members through the WhatsApp Business Platform. You confirm that you have your members' permission to message them, and that they can ask to stop. Each plan includes a monthly message allowance. Messages are sent only between 9 am and 9 pm India time. We are not responsible for messages that WhatsApp or the phone network fails to deliver.</p>
    </Section>

    <Section title="Acceptable use">
      <p>Do not use the service for anything unlawful, to send spam, to try to break into other accounts, or to copy or resell the service. We may suspend an account that does this.</p>
    </Section>

    <Section title="Availability and changes">
      <p>We work to keep the service running but cannot promise it will never be interrupted. We may change features or prices; a price change applies from your next payment and never to a period you have already paid for. We will tell you about material changes to these terms by email or in the app.</p>
    </Section>

    <Section title="Liability">
      <p>The service is provided as is. To the extent the law allows, our total liability for any claim is limited to the fees you paid us in the 3 months before the claim. We are not liable for lost profits or indirect loss.</p>
    </Section>

    <Section title="Refunds and cancellation">
      <p>See our <a href="/refund" className="text-teal-600">Refund and Cancellation Policy</a>.</p>
    </Section>

    <Section title="Law and contact">
      <p>These terms are governed by the laws of India. Courts at {company.state} have jurisdiction. Questions: <Contact />.</p>
    </Section>
  </LegalLayout>
);

export default Terms;
