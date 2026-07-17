/**
 * FoodUSD vendor-lock (policy variable, open decision #7) — narrows FoodUSD from
 * a free-floating 1:1 stablecoin toward the spend-limited, vendor-redeemable
 * `$CRED` model: under vendor-lock, FoodUSD may only be transferred TO an
 * approved vendor, not peer-to-peer. Default is free transfer (current behaviour).
 */

import { FoodUSDModel } from '../foodusd-model';

describe('FoodUSD vendor-lock policy', () => {
  const funded = (opts: Record<string, unknown> = {}) => {
    const f = new FoodUSDModel(opts);
    f.initializeHolders(['0xA', '0xB', '0xVENDOR']);
    f.mint('0xA', 10);
    return f;
  };

  it('allows any transfer by default (free-floating utility)', () => {
    const f = funded();
    expect(f.transfer('0xA', '0xB', 1)).toBe(true);
  });

  it('under vendor-lock, allows transfer to an approved vendor but blocks peer-to-peer', () => {
    const f = funded({ vendorLocked: true, approvedVendors: ['0xVENDOR'] });
    expect(f.transfer('0xA', '0xVENDOR', 1)).toBe(true);
    expect(() => f.transfer('0xA', '0xB', 1)).toThrow(/vendor/i);
  });
});
