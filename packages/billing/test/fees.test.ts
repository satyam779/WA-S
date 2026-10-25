import { describe, expect, it } from 'vitest';
import { ACCOUNT, InsufficientBalanceError, chargeFee } from '../src/index';

describe('chargeFee', () => {
  it('moves the fee from the wallet to revenue', () => {
    const result = chargeFee({ balance: 1_000_000_000, reserved: 0 }, 'w1', 999_000_000);
    expect(result.wallet.balance).toBe(1_000_000);
    expect(result.transfers).toEqual([{ debit: ACCOUNT.wallet('w1'), credit: ACCOUNT.revenue, amount: 999_000_000 }]);
  });

  it('refuses to overdraw, counting money on hold', () => {
    expect(() => chargeFee({ balance: 1_000_000_000, reserved: 2_000_000 }, 'w1', 999_000_000)).toThrow(InsufficientBalanceError);
  });
});
