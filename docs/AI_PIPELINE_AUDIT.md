# V3.0.1 pipeline audit

Base: `v3.0-fix2-build`, commit `2c1029aa720b349943291e9b1b769bae367f6d2c`, successful GitHub Actions Build 134.

## Findings and repairs

- Training actually ran on the supplied export. Original gold outcome: `INSUFFICIENT_VALIDATION_TRADES`; original BTC outcome: `NO_PROVEN_IMPROVEMENT`. A rejected promotion was presented as if AI training did not work.
- Journal observation gaps over 90 seconds were recorded but outcomes were subsequently labeled from resumed quotes. Those results cannot prove whether TP or SL occurred first. New gaps censor the outcome; old gap-tainted labels are excluded. Gold market session gaps in OHLC are a separate concept and do not make an unobserved trade trustworthy.
- OPEN records were never upgraded on reimport. Imports now merge observed final outcomes only when the original snapshot, symbol, time and position levels match; finalized labels are immutable. Invalid records are counted, valid rejected snapshots are retained for diagnosis, and duplicate records in one file do not abort the transaction.
- Temporal partitions retain the original 50/25/25 cold-start allocation, group snapshots and simultaneous timestamps, and purge only labels crossing the 60-second boundary embargo. No shuffle or thresholds were changed.
- Repeated training previously could reuse old validation/test periods. Both must now be after the persisted evaluation watermark. Every evaluated holdout is consumed even on rejected validation or insufficient test trades. Export/restore carries monotonic watermarks; imported models do not become live models.
- Evaluation reports sample counts, split deficits, purged labels, WAIT decisions, overlapping trades and missing selected-side outcomes. BUY and SELL labels for one decision do not represent two independent trading opportunities. Missing outcomes cannot support promotion.
- Worker construction failure on Android file URLs is now included in the fallback path. Training reads the full journal, and evaluation status is saved and restored per symbol. Old models without outcome-continuity policy are archived but require retraining before live use.
- OHLC normalization marks candles whose close time has not arrived as open. Synthetic tick candles remain unconfirmed. Gold session gaps are recognized only in the common New York 17:00–18:00 maintenance/weekend window, with DST; arbitrary intraday gaps and BTC H1/H4 gaps fail closed. This is a conservative default, not a verified BiQuote holiday calendar. Provider-specific holidays/extended halts still block until valid data resumes. Reference for variation between providers: https://www.oanda.com/uk-en/trading/hours-of-operation/ .
- Fixed a missing chart cancellation method causing a JavaScript exception on visibility changes/reload. Feed status now includes closed-frame validity.

## Actual supplied export replay

Input SHA-256: `958d821c965b85ff13f6c35f0e5f64f02d313344c4c23bb1cc651fe6d46b4612`.
162 decisions imported; repeating import adds zero duplicates. The private source is not committed.

| Symbol | Original labels | Uninterrupted valid labels | Excluded gap labels | Train | Validation | Test | Outcome |
|---|---:|---:|---:|---:|---:|---:|---|
| XAUUSD | 107 | 48 | 59 | 20 | 5 | 13 | INSUFFICIENT_DATA: validation needs at least 6 labels |
| BTCUSD | 90 | 47 | 43 | 21 | 9 | 13 | Trained/tested; NO_PROVEN_IMPROVEMENT |

Gold purges 10 labels and BTC 4 at temporal boundaries. BTC test has 4 executable nonoverlapping trades, with mean -0.526R; 4 other decision groups overlap open test positions. No promotion is justified by this export. More *uninterrupted, new* observations are required; more labels do not guarantee an edge.

The export contains 36 GAP_M5 and 2 GAP_M15 rejected snapshots, without their raw candles. Historical gap locations cannot be reconstructed or retroactively certified. Retained clean gold snapshots have aggregate higher-frame gaps consistent with normal sessions; absence of raw OHLC remains an audit limitation. No missing candles or outcomes were fabricated.

## Verification

- 63 Node tests: continuity, import upgrades/duplicates/rollback safeguards, monotonic watermarks, temporal independence, BUY/SELL/WAIT, mandatory safety, promoted-model reload and outcome-to-training lifecycle.
- Playwright mobile UI: cold start, real file input, worker training, synchronous Worker failure fallback, per-symbol status and model persistence, responsive widths, visibility/reload without JavaScript errors. Run with both synthetic learnable data and the supplied export.
- Reproduce private replay: `node scripts/replay-export.cjs /path/to/export.json` (report in `test-results/export-replay.json`).
- UI with real input: `REAL_EXPORT=/path/to/export.json npm run test:ui`.
- GitHub Actions builds/lints Android and checks APK signing after the unit and browser tests pass. App ID stays `com.marketai.scalp`; versionCode increases from 30 to 31. Build uses the existing debug signing-key cache.

Independent review identified the duplicate-import rollback, missing nonterminal R, and batched watermark regression. All have failing-then-passing regression tests. No remaining critical/important review findings.
