import LegalLayout from '../../components/public/LegalLayout';

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">{title}</h2>
    <div className="text-gray-600 text-sm leading-relaxed space-y-3">{children}</div>
  </div>
);

const AppPrivacy = () => (
  <LegalLayout title="App Privacy Policy">
    <p className="text-gray-500 text-sm mb-8 bg-teal-50 border border-teal-100 rounded-xl p-4">
      This App Privacy Policy applies to the GymDesk mobile application available on iOS and Android platforms. By using our app, you consent to the collection and use of information in accordance with this policy.
    </p>

    <Section title="Information We Collect via the App">
      <p>When you use the GymDesk mobile app, we may collect the following types of information:</p>
      <ul className="list-disc pl-5 space-y-1 text-gray-500">
        <li><strong>Account information:</strong> Name, email address, phone number, and profile photo</li>
        <li><strong>Health & fitness data:</strong> BMI readings, workout logs, attendance records</li>
        <li><strong>Device information:</strong> Device type, OS version, unique device identifiers</li>
        <li><strong>Usage data:</strong> Features used, session duration, in-app actions</li>
        <li><strong>Location data:</strong> Only when you grant permission, for gym check-in features</li>
      </ul>
    </Section>

    <Section title="How We Use App Data">
      <ul className="list-disc pl-5 space-y-1 text-gray-500">
        <li>To provide and maintain the app's functionality</li>
        <li>To track your fitness progress and attendance</li>
        <li>To send push notifications for class reminders and membership renewals</li>
        <li>To enable communication between members and gym staff</li>
        <li>To improve app performance and user experience</li>
      </ul>
    </Section>

    <Section title="Permissions Required">
      <p>The GymDesk app may request the following permissions:</p>
      <ul className="list-disc pl-5 space-y-1 text-gray-500">
        <li><strong>Camera:</strong> For profile photo and QR code scanning</li>
        <li><strong>Push Notifications:</strong> For class reminders and alerts</li>
        <li><strong>Location (optional):</strong> For gym check-in via geofencing</li>
        <li><strong>Storage:</strong> To save workout plans and progress reports locally</li>
      </ul>
      <p>You can revoke any permission at any time through your device settings.</p>
    </Section>

    <Section title="Data Storage & Security">
      <p>All app data is stored securely on encrypted cloud servers. We use industry-standard encryption protocols (SSL/TLS) to protect data in transit. Sensitive data such as payment information is never stored on your device.</p>
      <p>We implement OTP-based authentication, session management, and automatic logout to protect your account from unauthorized access.</p>
    </Section>

    <Section title="Data Sharing">
      <p>We do not sell, trade, or rent your personal information to third parties. We may share data with:</p>
      <ul className="list-disc pl-5 space-y-1 text-gray-500">
        <li>Your gym's admin staff (for member management purposes)</li>
        <li>Payment processors (for billing transactions only)</li>
        <li>Analytics providers (aggregated, anonymized data only)</li>
      </ul>
    </Section>

    <Section title="Data Retention & Deletion">
      <p>Your data is retained as long as you maintain an active account. You can request deletion of your data at any time by contacting us or using the "Delete Account" option in the app settings. We will process deletion requests within 30 days.</p>
    </Section>

    <Section title="Children's Privacy">
      <p>The GymDesk app is not intended for use by children under 13 years of age. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal data, please contact us immediately.</p>
    </Section>

    <Section title="Changes to This Policy">
      <p>We may update this App Privacy Policy from time to time. We will notify you of any changes by sending a push notification or updating the "Last updated" date at the top of this page. We encourage you to review this policy periodically.</p>
    </Section>

    <div className="mt-10 p-6 bg-gray-50 rounded-2xl border border-gray-100">
      <h3 className="font-bold text-gray-800 mb-3">Contact Us</h3>
      <div className="text-sm text-gray-500 space-y-1">
        <p><strong>GymDesk</strong> — Privacy Department</p>
        <p>Email: <a href="mailto:info@gymdesk.in" className="text-teal-600 hover:underline">info@gymdesk.in</a></p>
        <p>Phone: <a href="tel:+918587885643" className="text-teal-600 hover:underline">+91 85878 85643</a></p>
      </div>
    </div>
  </LegalLayout>
);

export default AppPrivacy;
