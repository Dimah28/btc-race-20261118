// Deep-dip reversal rider for make.fun "Race a BTC trading bot live for 24 hours"
// (btc-race-24h-20261118-1444). Long-only cbBTC/USDC, 1-minute bars, $1,000 paper.
//
// What the dev window (24h, BTC -2.79%, $65,074 -> $63,261, range
// $63,076-$65,190) showed: a falling day with one durable V. The day's only
// real edge was a deep dip that reversed into a multi-hour climb back toward
// the day's high. Everything else bled out: yesterday's winning parameters
// (dip 1.0% over 60 bars, tight 0.4% trail, 240-bar hold) LOSE -$22.51 on
// this window, momentum entries lose $4-$6, RSI mean-reversion loses
// $32-$37, and short-lookback dip scalps lose $1-$12 — all mostly fees, at
// ~26 bps per full-size round trip against ~6 bps of 1-minute noise.
// This bot therefore waits for a rare, deep dip measured against the
// recent high, then gives the reversal room to run instead of capping it:
//
//   Entry: close down >= 2.0% from the highest close of the last 120 bars
//          AND an uptick (close above the previous bar's close), full cash,
//          one position.
//   Exit:  +2.0% from the fill price, or -1.6%, or 720 bars held, or a
//          trailing stop: once the trade is up > +0.2%, sell if the close
//          falls 0.8% below the highest close since entry.
//          Sells the whole position.
//   max_slippage_bps 300 on every order.
//
// Offline replay of the same rules on the dev window (same fill model:
// next-open fills, 4 bps fee, 2 bps slippage, constant-product impact
// against the bar's open depth): net PnL +$18.94, 1 round trip
// (bought ~$63,801, sold ~$65,062, +1.98%), max drawdown 0.65%.
// The same rules on the previous day's dev window (20261117-0603, BTC
// +0.53%) also profit: +$7.85, 1 round trip — so the edge is not fitted
// to a single day. At double fees the dev PnL is still +$17.72.
// Neighbours stay positive: dip 1.8-2.2% over 90-180 bars, trail 0.8-1.0%,
// hold 480-1440 bars all score +$9 to +$19 offline; the cliff is only
// below a 0.6% trail (+$3.11) or a 1.2% dip threshold (+$0.14), both
// avoided here. One trade decides this window, so no claim is made that
// the race window will look the same — the bet is structural: deep dips
// reverse, and winners need room.
// No randomness, no clock, no network: the only state is the close
// history, the entry fill price and the peak close since entry, so two
// runs on the same data produce byte-identical orders.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Strategy parameters (basis points unless noted).
const LOOKBACK = 120; // entry dip measured against the high of this many bars
const DIP_BPS = 200; // enter when close is down >= 2.0% from that high
const TP_BPS = 200; // take profit +2.0% from the fill price
const SL_BPS = 160; // stop loss -1.6% from the fill price
const TRAIL_BPS = 80; // trailing stop: 0.8% below the peak close since entry
const TRAIL_ARM_BPS = 20; // trailing stop arms once the trade is up > +0.2%
const HOLD_BARS = 720; // time stop: sell after 720 bars held
const MAX_SLIPPAGE_BPS = 300;

const closes: bigint[] = [];
let entryPrice: bigint | null = null;
let entrySeq = -1;
let peakClose: bigint | null = null;

function bpsChange(now: bigint, before: bigint): bigint {
  // (now - before) / before, in basis points, truncated toward zero.
  return ((now - before) * 10_000n) / before;
}

type ExitReason = 'take-profit' | 'stop-loss' | 'time-stop' | 'trailing-stop';

// Pure exit decision, evaluated in a fixed priority order: take-profit,
// stop-loss, time stop, then the trailing stop. Inputs are already in
// basis points / bars, so the result depends only on the trade's state,
// never on market data read a second time.
function exitReason(
  retBps: bigint,
  heldBars: number,
  trailedOff: boolean,
): ExitReason | null {
  if (retBps >= BigInt(TP_BPS)) return 'take-profit';
  if (retBps <= -BigInt(SL_BPS)) return 'stop-loss';
  if (heldBars >= HOLD_BARS) return 'time-stop';
  if (trailedOff) return 'trailing-stop';
  return null;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    // Remember the fill price of any buy that landed on this batch, so the
    // exit is measured from what we actually paid, fees and impact included.
    for (const fill of batch.fills) {
      if (fill.status === 'filled' && fill.symbol === SYMBOL) {
        if (fill.side === 'buy') {
          entryPrice = BigInt(fill.price);
          entrySeq = batch.seq;
          peakClose = entryPrice;
        } else {
          entryPrice = null;
          entrySeq = -1;
          peakClose = null;
        }
      }
    }

    if (state.warmingUp) return [];
    const bar = state.latest.get(SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    closes.push(close);

    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;

    if (qty > 0n) {
      // Holding: take profit, stop loss, time stop, or trailing stop.
      if (entryPrice !== null && peakClose !== null) {
        if (close > peakClose) peakClose = close;
        const ret = bpsChange(close, entryPrice);
        const heldBars = batch.seq - entrySeq;
        const trailedOff =
          ret > TRAIL_ARM_BPS &&
          close * 10_000n <= peakClose * (10_000n - BigInt(TRAIL_BPS));
        if (exitReason(ret, heldBars, trailedOff) !== null) {
          return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      }
      return [];
    }

    // Flat: enter on a deep dip from the 120-bar high, confirmed by an uptick.
    if (closes.length <= LOOKBACK + 1) return [];
    const prev = closes[closes.length - 2];
    if (close <= prev) return [];
    let high = closes[closes.length - 1 - LOOKBACK];
    for (let i = closes.length - LOOKBACK; i < closes.length; i++) {
      if (closes[i] > high) high = closes[i];
    }
    if (bpsChange(close, high) <= -DIP_BPS && state.cash > 0n) {
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
