import type { Metadata } from 'next';
import { LegalPage } from '@/components/site';
import { BRAND, SITE } from '@/lib/env';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="25 October 2026">
      <p>
        {SITE.company} (“we”, “us”) runs {BRAND} at {SITE.url}. This policy explains what personal data we handle, why, and your choices.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: your name, business name, email address and a secure hash of your password.</li>
        <li>WhatsApp account details shared by Meta when you connect: account and phone number IDs, display name and quality rating.</li>
        <li>Contacts you upload: phone numbers and names.</li>
        <li>Message records: recipient number, template name, delivery status and time. We do not store OTP codes or the values you fill into templates.</li>
        <li>Payment records: amounts and Razorpay order and payment IDs. Card and bank details are handled by Razorpay and never reach us.</li>
        <li>Technical data such as IP address and browser, used for security.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To provide the service: sending the messages you request through Meta’s WhatsApp Business Platform, billing, support, preventing
        fraud and abuse, and meeting legal obligations. We do not sell personal data, and we never use your contacts for our own marketing.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>Meta Platforms, to deliver WhatsApp messages. Meta’s own terms and policies apply to that processing.</li>
        <li>Razorpay, to process payments.</li>
        <li>Our hosting, database and email providers, who process data only on our instructions.</li>
        <li>Authorities, when the law requires it.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Account data for as long as your account is open. Message records for up to 12 months. Contacts until you delete them or close your
        account. Payment records for as long as Indian tax law requires.
      </p>

      <h2>Your rights</h2>
      <p>
        Under India’s Digital Personal Data Protection Act, 2023 you can ask to access, correct or delete your personal data, and withdraw
        consent. Email us at {SITE.supportEmail}; we reply within 30 days.
      </p>

      <h2>Your responsibilities</h2>
      <p>
        When you upload contacts or send messages, you are responsible for having the recipients’ permission, as WhatsApp’s policies require.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, secrets are encrypted at rest, and access is limited to the people who need it. No system is perfectly
        secure; we will tell you promptly if a breach affects your data.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We will post changes on this page and email you about important ones. Questions: {SITE.supportEmail}.
      </p>
    </LegalPage>
  );
}
