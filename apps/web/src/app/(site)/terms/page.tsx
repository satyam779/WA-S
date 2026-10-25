import type { Metadata } from 'next';
import { LegalPage } from '@/components/site';
import { BRAND, SITE } from '@/lib/env';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="25 October 2026">
      <p>
        These terms are an agreement between you and {SITE.company} for the use of {BRAND}. By creating an account you accept them.
      </p>

      <h2>1. The service</h2>
      <p>
        {BRAND} lets businesses send WhatsApp messages, such as one-time passwords, order updates, reminders and promotions, through Meta’s
        WhatsApp Business Platform, using our dashboard and API.
      </p>

      <h2>2. Your account</h2>
      <p>
        Give accurate details, keep your password and API keys secret, and tell us at once if you suspect misuse. You are responsible for
        everything done with your account and keys.
      </p>

      <h2>3. WhatsApp rules</h2>
      <ul>
        <li>You must follow the WhatsApp Business Terms of Service, Business Messaging Policy and Commerce Policy.</li>
        <li>Only message people who agreed to hear from you on WhatsApp, and stop when they opt out.</li>
        <li>No spam, and nothing illegal, misleading, harmful or infringing.</li>
      </ul>
      <p>
        Meta may restrict your WhatsApp account or templates under its own rules. We may suspend accounts that break these rules or put the
        service at risk.
      </p>

      <h2>4. Prices and payment</h2>
      <p>
        You prepay into a wallet. We deduct our fee for each delivered message at the prices shown on our website; failed messages are not
        charged. Prices exclude GST. We will give at least 15 days’ notice of price increases. While Meta bills you directly for its own
        message fees, those are between you and Meta.
      </p>

      <h2>5. Availability</h2>
      <p>
        We work to keep the service running, but we depend on Meta and other providers and cannot guarantee it will be uninterrupted or
        error-free.
      </p>

      <h2>6. Liability</h2>
      <p>
        The service is provided “as is”. To the extent the law allows, we are not liable for indirect or consequential losses, and our total
        liability for any claim is limited to the amount you paid us in the 3 months before the claim.
      </p>

      <h2>7. Ending the agreement</h2>
      <p>
        You can close your account at any time. We may suspend or close accounts that breach these terms. Our Refund Policy covers any unused
        wallet balance.
      </p>

      <h2>8. Law</h2>
      <p>These terms are governed by the laws of India. Disputes go to the courts where {SITE.company} has its registered office.</p>

      <h2>9. Contact</h2>
      <p>{SITE.supportEmail}</p>
    </LegalPage>
  );
}
