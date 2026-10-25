import { describe, expect, it } from 'vitest';
import {
  ACCOUNT,
  InsufficientBalanceError,
  NoRateError,
  available,
  decideSettlement,
  formatRupees,
  gstOn,
  reserve,
  resolveRate,
  rupees,
  settle,
  toPaiseCeil,
  topUp,
  type Rate,
} from '../src/index';

describe('money', () => {
  it('parses rupee strings exactly', () => {
    expect(rupees('0.115')).toBe(115_000);
    expect(rupees('0.8631')).toBe(863_100);
    expect(rupees('2.4971')).toBe(2_497_100);
    expect(rupees('20')).toBe(20_000_000);
    expect(() => rupees('1.2.3')).toThrow(RangeError);
  });

  it('formats, rounds to paise and computes GST', () => {
    expect(formatRupees(863_100)).toBe('₹0.8631');
    expect(formatRupees(1_000_000)).toBe('₹1.00');
    expect(formatRupees(-50_000)).toBe('-₹0.05');
    expect(toPaiseCeil(115_000)).toBe(12);
    expect(gstOn(rupees('100'))).toBe(rupees('18'));
  });
});

describe('resolveRate', () => {
  const base = { plan: 'starter', category: 'UTILITY', billingMode: 'DIRECT_META', metaCostMicros: 0 } as const;
  const rates: Rate[] = [
    { ...base, country: '*', effectiveFrom: new Date('2026-01-01'), priceMicros: 60_000 },
    { ...base, country: 'IN', effectiveFrom: new Date('2026-01-01'), priceMicros: 40_000 },
    { ...base, country: 'IN', effectiveFrom: new Date('2026-07-01'), priceMicros: 50_000 },
    { ...base, country: 'IN', effectiveFrom: new Date('2027-01-01'), priceMicros: 99_000 },
  ];
  const query = { plan: 'starter', category: 'UTILITY', billingMode: 'DIRECT_META', at: new Date('2026-10-25') } as const;

  it('prefers the exact country, then the latest rate in effect', () => {
    expect(resolveRate(rates, { ...query, country: 'IN' }).priceMicros).toBe(50_000);
    expect(resolveRate(rates, { ...query, country: 'AE' }).priceMicros).toBe(60_000);
  });

  it('throws when nothing matches', () => {
    expect(() => resolveRate(rates, { ...query, country: 'IN', category: 'MARKETING' })).toThrow(NoRateError);
  });
});

describe('wallet', () => {
  const empty = { balance: 0, reserved: 0 };

  it('blocks a reservation the wallet cannot cover', () => {
    const { wallet } = topUp(empty, 'w1', 100_000);
    expect(available(reserve(wallet, 100_000))).toBe(0);
    expect(() => reserve(wallet, 100_001)).toThrow(InsufficientBalanceError);
  });

  it('captures with a Meta/markup split and ignores duplicate settlement', () => {
    const wallet = reserve(topUp(empty, 'w1', 1_000_000).wallet, 170_000);
    const held = { amount: 170_000, status: 'HELD' } as const;
    const result = settle(wallet, 'w1', held, { kind: 'capture', charge: { price: 170_000, metaCost: 115_000 } })!;

    expect(result.wallet).toEqual({ balance: 830_000, reserved: 0 });
    expect(result.transfers).toEqual([
      { debit: ACCOUNT.wallet('w1'), credit: ACCOUNT.metaPayable, amount: 115_000 },
      { debit: ACCOUNT.wallet('w1'), credit: ACCOUNT.revenue, amount: 55_000 },
    ]);
    expect(settle(result.wallet, 'w1', result.reservation, { kind: 'release' })).toBeNull();
  });

  it('releases the hold without charging', () => {
    const wallet = reserve({ balance: 500_000, reserved: 0 }, 50_000);
    const result = settle(wallet, 'w1', { amount: 50_000, status: 'HELD' }, { kind: 'release' })!;
    expect(result.wallet).toEqual({ balance: 500_000, reserved: 0 });
    expect(result.transfers).toEqual([]);
  });

  it('lets a recategorised message overdraw instead of losing the charge', () => {
    const wallet = reserve({ balance: 50_000, reserved: 0 }, 50_000);
    const result = settle(wallet, 'w1', { amount: 50_000, status: 'HELD' }, {
      kind: 'capture',
      charge: { price: 80_000, metaCost: 0 },
    })!;
    expect(result.wallet.balance).toBe(-30_000);
  });
});

describe('decideSettlement', () => {
  it('maps status webhooks to settlement', () => {
    expect(decideSettlement('sent', { billable: true, category: 'utility' })).toEqual({ kind: 'wait' });
    expect(decideSettlement('delivered', { billable: true, category: 'authentication-international' })).toEqual({
      kind: 'capture',
      category: 'AUTHENTICATION_INTERNATIONAL',
    });
    expect(decideSettlement('read', { billable: false, category: 'service' })).toEqual({ kind: 'release' });
    expect(decideSettlement('failed')).toEqual({ kind: 'release' });
    expect(decideSettlement('delivered')).toEqual({ kind: 'wait' });
  });
});
