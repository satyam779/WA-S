import type { Micros } from './money';

export interface WalletState {
  /** Prepaid funds. Can go negative if Meta bills a pricier category than we reserved for. */
  balance: Micros;
  /** Sum of HELD reservations. */
  reserved: Micros;
}

export type ReservationStatus = 'HELD' | 'CAPTURED' | 'RELEASED';

export interface Reservation {
  amount: Micros;
  status: ReservationStatus;
}

export const ACCOUNT = {
  cash: 'asset:cash',
  promo: 'expense:promo',
  revenue: 'income:platform',
  metaPayable: 'liability:meta',
  wallet: (walletId: string) => `liability:wallet:${walletId}`,
} as const;

/** One double-entry movement; the ledger stores these as rows. */
export interface Transfer {
  debit: string;
  credit: string;
  amount: Micros;
}

export interface Charge {
  price: Micros;
  metaCost: Micros;
}

export class InsufficientBalanceError extends Error {
  constructor(
    readonly available: Micros,
    readonly required: Micros,
  ) {
    super(`Insufficient balance: need ${required} micros, have ${available}`);
    this.name = 'InsufficientBalanceError';
  }
}

export const available = (wallet: WalletState): Micros => wallet.balance - wallet.reserved;

export function topUp(wallet: WalletState, walletId: string, amount: Micros, source: 'cash' | 'promo' = 'cash') {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError(`Bad top-up amount: ${amount}`);
  return {
    wallet: { ...wallet, balance: wallet.balance + amount },
    transfers: [{ debit: ACCOUNT[source], credit: ACCOUNT.wallet(walletId), amount }] as Transfer[],
  };
}

export function reserve(wallet: WalletState, amount: Micros): WalletState {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError(`Bad reservation amount: ${amount}`);
  if (available(wallet) < amount) throw new InsufficientBalanceError(available(wallet), amount);
  return { ...wallet, reserved: wallet.reserved + amount };
}

export type Outcome = { kind: 'capture'; charge: Charge } | { kind: 'release' };

/**
 * Settles a HELD reservation. Returns null if it was already settled, so a duplicate
 * or late webhook can never charge twice.
 */
export function settle(wallet: WalletState, walletId: string, reservation: Reservation, outcome: Outcome) {
  if (reservation.status !== 'HELD') return null;
  const unheld: WalletState = { ...wallet, reserved: wallet.reserved - reservation.amount };
  if (outcome.kind === 'release') {
    return { wallet: unheld, reservation: { ...reservation, status: 'RELEASED' as const }, transfers: [] as Transfer[] };
  }

  const { price, metaCost } = outcome.charge;
  if (metaCost < 0 || price < metaCost) throw new RangeError(`Price ${price} below Meta cost ${metaCost}`);
  const transfers: Transfer[] = [];
  if (metaCost > 0) transfers.push({ debit: ACCOUNT.wallet(walletId), credit: ACCOUNT.metaPayable, amount: metaCost });
  if (price > metaCost) transfers.push({ debit: ACCOUNT.wallet(walletId), credit: ACCOUNT.revenue, amount: price - metaCost });
  return {
    wallet: { ...unheld, balance: unheld.balance - price },
    reservation: { ...reservation, status: 'CAPTURED' as const },
    transfers,
  };
}

/** Deducts a fee (e.g. a monthly plan) straight from the balance; never overdraws. */
export function chargeFee(wallet: WalletState, walletId: string, amount: Micros) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError(`Bad fee amount: ${amount}`);
  if (available(wallet) < amount) throw new InsufficientBalanceError(available(wallet), amount);
  return {
    wallet: { ...wallet, balance: wallet.balance - amount },
    transfers: [{ debit: ACCOUNT.wallet(walletId), credit: ACCOUNT.revenue, amount }] as Transfer[],
  };
}
