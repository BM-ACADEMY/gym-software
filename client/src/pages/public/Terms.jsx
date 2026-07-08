import LegalLayout from '../../components/public/LegalLayout';

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">{title}</h2>
    <div className="text-gray-600 text-sm leading-relaxed space-y-3">{children}</div>
  </div>
);

const Terms = () => (
  <LegalLayout title="Terms & Conditions">
    <p className="text-gray-500 text-sm mb-8 bg-violet-50 border border-violet-100 rounded-xl p-4">
      This document governs the use of the GymDesk platform (the "Website" and "App"). By using our services, you agree to be bound by these Terms & Conditions. Please read them carefully before proceeding.
    </p>

    <Section title="General Terms">
      <p>The domain name gymdesk.in is owned and operated by GymDesk Technologies Pvt. Ltd. The use of this website by you is solely governed by this policy and any policy mentioned by terms of reference.</p>
      <p>Moving past the home page, or using any of the services, shall be taken to mean that you have read and agreed to all of the policies and have undertaken binding obligations with the Company.</p>
      <p>We hold the sole right to modify these Terms of Service without prior permission. If you continue to use the website following such a change, this is deemed as consent to the amended policies.</p>
    </Section>

    <Section title="User Account">
      <p>To use GymDesk, you must register an account and provide accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
      <p>You agree to immediately notify us of any unauthorized use of your account. GymDesk will not be liable for any loss or damage arising from your failure to comply with this security obligation.</p>
    </Section>

    <Section title="Subscription & Payment">
      <p>Your subscription for GymDesk is on a Pay-As-You-Go basis and will start when GymDesk confirms your payment. Subscriptions will continue auto-renewing until you cancel.</p>
      <p>At the end of each subscription period, you will automatically be renewed for an additional term of the same duration. If you do not wish your subscription to auto-renew, you may email us at <a href="mailto:info@gymdesk.in" className="text-violet-600">info@gymdesk.in</a> to cancel prior to the end of your current subscription term.</p>
    </Section>

    <Section title="Cancellation & Refund Policy">
      <p>If for any reason our services do not meet your needs, let us know within <strong>21 days</strong> of your purchase and we will issue you a full refund.</p>
      <p>You shall have twenty-one (21) days from the date of purchase to determine whether the Purchased Services do not meet your needs. If the Purchased Services do not meet your needs, you must notify GymDesk in writing within twenty-one (21) days and we will refund the corresponding subscription fees via bank transfer, less the cost of any services provided prior to such cancellation.</p>
      <p>The refund will be processed within twenty-one (21) days of request.</p>
    </Section>

    <Section title="Health Guidelines">
      <p><strong>Medical Clearance:</strong> Users must ensure they have obtained medical clearance from a qualified healthcare professional before starting any exercise program, particularly if they have pre-existing health conditions.</p>
      <p><strong>Physical Preparation:</strong> Users should ensure they are physically capable of participating in any exercise programs and do not have health conditions, injuries, or physical limitations that would prevent them from safely engaging in physical activity.</p>
      <p><strong>Informed Consent:</strong> Users must acknowledge that they understand the potential risks associated with exercise and are participating freely, taking into account all risks involved.</p>
      <p><strong>Disclaimer:</strong> GymDesk will not be responsible for any kind of health injuries in cases where relevant health information was not previously disclosed.</p>
    </Section>

    <Section title="Intellectual Property">
      <p>All content on the GymDesk platform, including but not limited to text, graphics, logos, software, and designs, are the property of GymDesk Technologies Pvt. Ltd. and are protected by applicable intellectual property laws.</p>
      <p>You may not reproduce, distribute, or create derivative works from any content on our platform without our explicit written permission.</p>
    </Section>

    <Section title="Limitation of Liability">
      <p>GymDesk shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service, even if GymDesk has been advised of the possibility of such damages.</p>
    </Section>

    <Section title="Governing Law">
      <p>These Terms of Service shall be governed by and construed in accordance with the laws of India. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts in India.</p>
    </Section>

    <Section title="Contact">
      <p>If you have any questions about these Terms & Conditions, please contact us at <a href="mailto:info@gymdesk.in" className="text-violet-600 hover:underline">info@gymdesk.in</a>.</p>
    </Section>

    <div className="mt-10 p-6 bg-gray-50 rounded-2xl border border-gray-100">
      <h3 className="font-bold text-gray-800 mb-3">Legal Contact</h3>
      <div className="text-sm text-gray-500 space-y-1">
        <p><strong>GymDesk Technologies Pvt. Ltd.</strong></p>
        <p>Email: <a href="mailto:info@gymdesk.in" className="text-violet-600 hover:underline">info@gymdesk.in</a></p>
        <p>Phone: <a href="tel:+918587885643" className="text-violet-600 hover:underline">+91 85878 85643</a></p>
      </div>
    </div>
  </LegalLayout>
);

export default Terms;
