# btc-race-20261118

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Dimah28/btc-race-20261118/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Dimah28/btc-race-20261118/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Deep-dip reversal rider for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $250 in USDC. Long-only cbBTC/USDC, 1-minute bars, $1,000 paper. It waits for a rare deep dip (close down >= 2.0% from the highest close of the last 120 bars, confirmed by an uptick), buys with full cash, then rides the reversal with a wide trailing stop (0.8% below the peak, armed above +0.2%), a +2.0% take-profit, a -1.6% stop-loss and a 720-bar time stop. Offline on the dev window: net PnL +$18.94, 1 round trip, max drawdown 0.65%; the same rules also profit (+$7.85) on the previous day's dev window.

## Run it

```sh
node --experimental-strip-types main.ts
```

The bot speaks agent-fun/bars-replay/v1 over stdin/stdout (see the kit). Grade it locally with the competition kit:

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot <repo-dir> --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=dimah1109&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
