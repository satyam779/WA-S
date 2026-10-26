import Link from 'next/link';
import { prisma } from '@wa/db';
import { OTP_TEMPLATE_NAME } from '@wa/meta';
import { ActionForm } from '@/components/action-form';
import { AutoRefresh } from '@/components/auto-refresh';
import { Badge, PageHeader, formatTime } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { USE_CASES } from '@/lib/use-cases';
import { replyAction } from '../actions';

// WhatsApp allows free-form replies only within 24 hours of the customer's last message.
const WINDOW_MS = 24 * 3600_000;

// Messages without text; we don't download media, so the business sees what kind it was.
const MEDIA: Record<string, string> = {
  revoke: 'Message deleted',
  image: '📷 Photo',
  video: '🎥 Video',
  audio: '🎤 Voice message',
  document: '📄 Document',
  sticker: 'Sticker',
  location: '📍 Location',
  contacts: 'Contact card',
  reaction: 'Reaction',
};

const TEMPLATE_TITLES: Record<string, string> = Object.fromEntries([
  [OTP_TEMPLATE_NAME, 'OTP code'],
  ...USE_CASES.map((u) => [u.template, u.title]),
]);

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const { orgId } = await requireUser();
  const people = await prisma.message.groupBy({
    by: ['contact'],
    where: { orgId, direction: 'IN' },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 50,
  });
  const contact = (await searchParams).with?.replace(/\D/g, '') || people[0]?.contact;
  // Newest first; the list below is column-reverse, so it shows oldest at the top and opens scrolled to the newest.
  const thread = contact ? await prisma.message.findMany({ where: { orgId, contact }, orderBy: { createdAt: 'desc' }, take: 50 }) : [];
  const lastWrote = people.find((p) => p.contact === contact)?._max.createdAt;
  const canReply = Boolean(lastWrote && Date.now() - lastWrote.getTime() < WINDOW_MS);

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHeader title="Chats" description="Messages your customers send to your WhatsApp number. Replies within 24 hours of their last message are free." />
      {!contact ? (
        <section className="card text-sm text-slate-500">No customer has written to your number yet. Their messages will appear here.</section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <nav aria-label="Customers" className="card max-h-[70vh] space-y-1 overflow-y-auto p-2">
            {people.map((p) => (
              <Link
                key={p.contact}
                href={`/dashboard/chats?with=${p.contact}`}
                aria-current={p.contact === contact ? 'page' : undefined}
                className={`block rounded-lg px-3 py-2 ${p.contact === contact ? 'bg-brand-50 ring-1 ring-brand-600/20' : 'hover:bg-slate-50'}`}
              >
                <span className="block text-sm font-medium text-slate-900">+{p.contact}</span>
                <span className="block text-xs text-slate-500">{p._max.createdAt && formatTime(p._max.createdAt)}</span>
              </Link>
            ))}
          </nav>
          <section className="card flex min-w-0 flex-col gap-4">
            <h2 className="text-lg font-bold">+{contact}</h2>
            <ol className="flex max-h-[55vh] flex-col-reverse gap-2 overflow-y-auto rounded-lg bg-[#efeae2] p-4">
              {thread.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${m.direction === 'IN' ? 'self-start bg-white' : 'self-end bg-[#d9fdd3]'}`}
                >
                  <p className="whitespace-pre-wrap break-words text-slate-900">
                    {m.body ??
                      (m.templateName ? `Template: ${TEMPLATE_TITLES[m.templateName] ?? m.templateName}` : (MEDIA[m.type] ?? `[${m.type}]`))}
                  </p>
                  <p className="mt-1 flex items-center justify-end gap-2 text-[11px] text-slate-500">
                    {formatTime(m.createdAt)}
                    {m.direction === 'OUT' && <Badge value={m.status} />}
                  </p>
                </li>
              ))}
            </ol>
            {canReply ? (
              <ActionForm action={replyAction} submit="Send reply" className="space-y-3">
                <input type="hidden" name="to" value={`+${contact}`} />
                <textarea name="text" rows={3} maxLength={4096} required className="input" placeholder="Type your reply…" />
              </ActionForm>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
                This customer last wrote more than 24 hours ago, so WhatsApp only allows approved templates now. Send one from{' '}
                <Link href="/dashboard/use-cases" className="link">
                  OTP &amp; updates
                </Link>
                .
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
