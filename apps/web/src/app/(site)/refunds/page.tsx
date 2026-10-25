import type { Metadata } from 'next';
import { LegalPage } from '@/components/site';
import { SITE } from '@/lib/env';

export const metadata: Metadata = { title: 'Refund Policy' };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund and Cancellation Policy" updated="25 October 2026">
      <h2>Wallet recharges</h2>
      <ul>
        <li>You can ask for a refund of unused wallet balance within 30 days of a recharge.</li>
        <li>Free credit, such as the signup bonus, is not refundable.</li>
        <li>Fees for delivered messages are not refundable. Failed messages are never charged.</li>
      </ul>

      <h2>How to ask</h2>
      <p>
        Email {SITE.supportEmail} from your account’s email address with the payment ID. Approved refunds go back to the original payment
        method within 5–7 working days.
      </p>

      <h2>Cancellation</h2>
      <p>
        There is no subscription to cancel. You can stop using the service or close your account at any time; unused balance is handled as
        above.
      </p>

      <h2>Meta’s fees</h2>
      <p>While Meta bills its own message fees to your WhatsApp account, refunds for those follow Meta’s policies.</p>
    </LegalPage>
  );
}
