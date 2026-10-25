import { prisma, type LedgerKind, type Prisma } from '@wa/db';
import {
  chargeFee,
  reserve,
  resolveRate,
  settle,
  topUp,
  type Micros,
  type Outcome,
  type Rate,
  type Transfer,
  type WalletState,
} from '@wa/billing';
import type { BillingMode, MessageCategory } from '@wa/shared';

type Tx = Prisma.TransactionClient;
type Locked = { id: string; state: WalletState };

/** Row-locks the org's wallet until the transaction ends, so balance checks can't race. */
async function lockWallet(tx: Tx, orgId: string): Promise<Locked> {
  const [row] = await tx.$queryRaw<{ id: string; balanceMicros: bigint; reservedMicros: bigint }[]>`
    SELECT id, "balanceMicros", "reservedMicros" FROM "Wallet" WHERE "orgId" = ${orgId} FOR UPDATE`;
  if (!row) throw new Error(`No wallet for org ${orgId}`);
  return { id: row.id, state: { balance: Number(row.balanceMicros), reserved: Number(row.reservedMicros) } };
}

async function save(tx: Tx, wallet: Locked, next: WalletState, transfers: Transfer[], kind: LedgerKind, extra: { messageId?: string; note?: string } = {}) {
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balanceMicros: BigInt(next.balance), reservedMicros: BigInt(next.reserved) },
  });
  if (transfers.length) {
    await tx.ledgerEntry.createMany({
      data: transfers.map((t) => ({ walletId: wallet.id, kind, debit: t.debit, credit: t.credit, amount: BigInt(t.amount), ...extra })),
    });
  }
}

/** Pass `tx` to credit inside a caller's transaction (e.g. together with marking a payment paid). */
export function creditWallet(orgId: string, amount: Micros, source: 'cash' | 'promo', note: string, tx?: Tx) {
  const run = async (t: Tx) => {
    const wallet = await lockWallet(t, orgId);
    const result = topUp(wallet.state, wallet.id, amount, source);
    await save(t, wallet, result.wallet, result.transfers, source === 'cash' ? 'TOP_UP' : 'PROMO', { note });
    return result.wallet;
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

/** Takes a fee (monthly plan) from the wallet. Throws InsufficientBalanceError rather than overdrawing. */
export function chargeWallet(orgId: string, amount: Micros, note: string) {
  return prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, orgId);
    const result = chargeFee(wallet.state, wallet.id, amount);
    await save(tx, wallet, result.wallet, result.transfers, 'SUBSCRIPTION', { note });
    return result.wallet;
  });
}

/** Holds the expected price and creates the message in one transaction. Throws InsufficientBalanceError. */
export function holdForMessage(orgId: string, amount: Micros, data: Omit<Prisma.MessageUncheckedCreateInput, 'orgId'>) {
  return prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, orgId);
    const next = reserve(wallet.state, amount);
    await tx.wallet.update({ where: { id: wallet.id }, data: { reservedMicros: BigInt(next.reserved) } });
    return tx.message.create({ data: { ...data, orgId, reservedMicros: BigInt(amount), reservationStatus: 'HELD' } });
  });
}

/** Captures or releases a message's hold; safe to call any number of times. */
export async function settleMessage(messageId: string, outcome: Outcome, billedCategory?: MessageCategory) {
  const { orgId } = await prisma.message.findUniqueOrThrow({ where: { id: messageId }, select: { orgId: true } });
  await prisma.$transaction(async (tx) => {
    const wallet = await lockWallet(tx, orgId);
    // Read the hold under the wallet lock so two webhooks for one message can't both settle it.
    const hold = await tx.message.findUniqueOrThrow({
      where: { id: messageId },
      select: { reservedMicros: true, reservationStatus: true },
    });
    const result = settle(wallet.state, wallet.id, { amount: Number(hold.reservedMicros), status: hold.reservationStatus }, outcome);
    if (!result) return;
    await save(tx, wallet, result.wallet, result.transfers, 'MESSAGE', { messageId });
    await tx.message.update({
      where: { id: messageId },
      data: {
        reservationStatus: result.reservation.status,
        ...(outcome.kind === 'capture' ? { chargedMicros: BigInt(outcome.charge.price), billedCategory } : {}),
      },
    });
  });
}

let rateCache: { loadedAt: number; rates: Rate[] } | undefined;

async function loadRates(): Promise<Rate[]> {
  if (rateCache && Date.now() - rateCache.loadedAt < 60_000) return rateCache.rates;
  const rows = await prisma.rate.findMany();
  const rates = rows.map((r) => ({ ...r, priceMicros: Number(r.priceMicros), metaCostMicros: Number(r.metaCostMicros) }));
  rateCache = { loadedAt: Date.now(), rates };
  return rates;
}

export async function priceFor(plan: string, category: MessageCategory, country: string, billingMode: BillingMode) {
  const rates = await loadRates();
  // Plans without their own rates use the free plan's.
  const ratePlan = rates.some((r) => r.plan === plan) ? plan : 'starter';
  const rate = resolveRate(rates, { plan: ratePlan, category, country, billingMode, at: new Date() });
  return { price: rate.priceMicros, metaCost: rate.metaCostMicros };
}
