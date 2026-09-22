# AI pipeline repair implementation plan

Goal: repair the v3.0-fix2-build data-to-learning pipeline without weakening risk or promotion gates.
Architecture: keep the browser/Android WebView design, IndexedDB journal, chronological trainer and mandatory RiskSafety engine. Use closed, uninterrupted observed outcomes only; report every exclusion and evaluation stage.
Tech stack: JavaScript, Node test runner, Playwright, Java Android, Gradle/GitHub Actions.
Spec: user request dated 2026-09-22; reference commit 2c1029a, successful Build 134.

Constraints: no fabricated outcomes, no random split, no held-out data reuse, no threshold reduction; preserve user data and APK application ID.
Review focus: repeated import updating OPEN outcomes; invalid imports and rollback; interrupted observations; duplicate snapshots and timestamp boundaries; worker startup failure and persisted evaluations.

- [x] Reproduce real export and baseline tests (162 decisions; keep private fixture outside git).
- [x] Add failing tests for interrupted outcomes, sample validation, split/holdout freshness, training diagnostics and real train/promotion lifecycle.
- [x] Repair trainer.js and decision-journal.js; run `npm test`.
- [x] Add failing session/calendar and closed-bar tests; repair features.js and market-data.js.
- [x] Exercise import/restore, worker fallback, signals and safety in real browser IndexedDB; update app.js and coordinator.js.
- [x] Replay the attached export, record counts/reasons, run full tests and JS syntax checks.
- [ ] Update APK version/workflow, build and lint in GitHub Actions, verify APK and deliver.

Ruling: execute in the fresh isolated clone on the user-requested branch, with no extra approval handoff; execution was explicitly authorized.
Ruling: keep historical gold labels whose observed outcomes are uninterrupted; old raw feature-gap provenance cannot be re-certified and is documented, rather than fabricating OHLC.
Independent review completed; all three important import findings received RED→GREEN regressions.
