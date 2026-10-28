import LegalLayout from '../../components/public/LegalLayout';
import Section, { DraftNotice } from '../../components/public/LegalSection';
import { company } from '../../config/company';

const Refund = () => (
  <LegalLayout title="Refund & Cancellation Policy">
    <DraftNotice />
    <Section title="Free trial">
      <p>The 14-day trial is free. You are not charged unless you choose a plan and pay.</p>
    </Section>

    <Section title="Cancelling">
      <p>Plans are prepaid and do not renew automatically, so there is nothing to cancel. If you do not pay again, your account becomes read-only after your paid period and a 3-day grace period. You can export your data at any time.</p>
    </Section>

    <Section title="Refunds">
      <p><strong>First payment:</strong> if {company.product} does not suit you, write to us within <strong>{company.refundDays} days</strong> of your first payment and we will refund it in full to the original payment method.</p>
      <p><strong>Renewals and upgrades:</strong> not refundable once paid, except where we charged you in error or charged twice. A failed payment where money left your account is refunded by the bank or Razorpay, usually within 5 to 7 working days.</p>
      <p>Refunds are made through Razorpay. GST charged on a refunded amount is refunded too, and we issue a credit note for it.</p>
    </Section>

    <Section title="How to ask">
      <p>
        {company.email
          ? <>Email <a href={`mailto:${company.email}`} className="text-teal-600">{company.email}</a> from your registered address with your gym name and payment date.</>
          : <>Use the support option inside the app with your gym name and payment date.</>}
        {' '}We reply within 2 working days.
      </p>
    </Section>
  </LegalLayout>
);

export default Refund;
