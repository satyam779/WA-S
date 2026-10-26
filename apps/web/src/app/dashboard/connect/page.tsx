import type { Metadata } from 'next';
import { prisma } from '@wa/db';
import { ConnectWizard } from '@/components/connect-wizard';
import { PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { metaBillingUrl } from '@/lib/meta-billing';

export const metadata: Metadata = { title: 'Connect WhatsApp' };

export default async function ConnectPage() {
  const user = await requireUser();
  const numbers = await prisma.phoneNumber.count({ where: { waba: { orgId: user.orgId } } });
  return (
    <>
      <PageHeader
        title={numbers ? 'Add a WhatsApp number' : 'Connect your WhatsApp number'}
        description="Five short steps, about 5 minutes. We set up your ready-made messages at the end."
      />
      <ConnectWizard
        appId={process.env.META_APP_ID ?? ''}
        configId={process.env.META_ES_CONFIG_ID ?? ''}
        version={env.metaGraphVersion}
        signupReady={Boolean(process.env.META_APP_ID && process.env.META_ES_CONFIG_ID)}
        partnerBusinessId={process.env.META_BUSINESS_ID ?? ''}
        billingUrl={metaBillingUrl()}
      />
    </>
  );
}
