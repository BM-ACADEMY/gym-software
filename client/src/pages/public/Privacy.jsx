import LegalLayout from '../../components/public/LegalLayout';

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">{title}</h2>
    <div className="text-gray-600 text-sm leading-relaxed space-y-3">{children}</div>
  </div>
);

const Privacy = () => (
  <LegalLayout title="Privacy Policy">
    <p className="text-gray-500 text-sm mb-8 bg-teal-50 border border-teal-100 rounded-xl p-4">
      At GymDesk, one of our main priorities is the privacy of our users. This Privacy Policy document contains types of information that is collected and recorded by GymDesk and how we use it. If you have additional questions or require more information, do not hesitate to contact us.
    </p>

    <Section title="Consent">
      <p>By using our website, you hereby consent to our Privacy Policy and agree to its terms.</p>
      <p>This Privacy Policy applies only to our online activities and is valid for visitors to our website with regards to the information that they shared and/or collected. This policy is not applicable to any information collected offline or via channels other than this website.</p>
    </Section>

    <Section title="Information We Collect">
      <p>The personal information that you are asked to provide, and the reasons why you are asked to provide it, will be made clear to you at the point we ask you to provide your personal information.</p>
      <p>If you contact us directly, we may receive additional information about you such as your name, email address, phone number, the contents of the message and/or attachments you may send us.</p>
      <p>When you register for an Account, we may ask for your contact information, including items such as name, company name, address, email address, and telephone number.</p>
    </Section>

    <Section title="How We Use Your Information">
      <p>We use the information we collect in various ways, including to:</p>
      <ul className="list-disc pl-5 space-y-1 text-gray-500">
        <li>Provide, operate, and maintain our website</li>
        <li>Improve, personalize, and expand our website</li>
        <li>Understand and analyse how you use our website</li>
        <li>Develop new products, services, features, and functionality</li>
        <li>Communicate with you, either directly or through one of our partners, for customer service and marketing purposes</li>
        <li>Send you emails and notifications</li>
        <li>Find and prevent fraud</li>
      </ul>
    </Section>

    <Section title="Log Files">
      <p>GymDesk follows a standard procedure of using log files. These files log visitors when they visit websites. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and the number of clicks. These are not linked to any personally identifiable information.</p>
    </Section>

    <Section title="Cookies and Web Beacons">
      <p>Like any other website, GymDesk uses cookies. These cookies are used to store information including visitors' preferences and the pages on the website that the visitor accessed or visited. The information is used to optimize the users' experience by customizing our web page content based on visitors' browser type and/or other information.</p>
    </Section>

    <Section title="Third Party Privacy Policies">
      <p>GymDesk's Privacy Policy does not apply to other advertisers or websites. We advise you to consult the respective Privacy Policies of these third-party servers for more detailed information. It may include their practices and instructions about how to opt-out of certain options.</p>
    </Section>

    <Section title="GDPR Data Protection Rights">
      <p>We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:</p>
      <ul className="list-disc pl-5 space-y-1 text-gray-500">
        <li><strong>The right to access</strong> – You have the right to request copies of your personal data.</li>
        <li><strong>The right to rectification</strong> – You have the right to request that we correct any information you believe is inaccurate.</li>
        <li><strong>The right to erasure</strong> – You have the right to request that we erase your personal data, under certain conditions.</li>
        <li><strong>The right to restrict processing</strong> – You have the right to request that we restrict the processing of your personal data.</li>
        <li><strong>The right to data portability</strong> – You have the right to request that we transfer the data we have collected to another organization, or directly to you.</li>
      </ul>
      <p>If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us.</p>
    </Section>

    <Section title="Children's Information">
      <p>GymDesk does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best to promptly remove such information from our records.</p>
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

export default Privacy;
