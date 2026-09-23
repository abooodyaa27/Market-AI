# V3.0.3 model quality audit

## Reproduced from the supplied decision-journal export

The supplied export contains 82 XAUUSD decisions. The observed-outcome collector accepts 48 side labels belonging to 32 distinct entry opportunities, all within approximately three hours on 21 September 2026. It rejects 59 side outcomes affected by missing observation intervals. The temporal split yields 23 train labels from 18 opportunities, 11 validation labels from six opportunities, and 10 test labels from six opportunities; four labels cross an embargo boundary and are purged. Paper positions have `execution: ANALYSIS_ONLY`; they are not broker trades.

The original fit assigned a separate intercept and 42 coefficients to BUY and SELL despite only 12 BUY and 11 SELL training labels. It predicted no positive edge in the six gold validation groups. V3.0.3 selects six indicators using a fixed feature list that cannot vary according to holdout results, applies stronger weight shrinkage, and requires each side to have more training labels than fitted coefficients. Other feature weights remain zero so validated model and live snapshot interfaces stay compatible. The supplied gold export still does **not** qualify for promotion: the new candidate has one selected-side observation missing, one eligible validation trade and four overlaps while one higher threshold makes six WAIT decisions. This is a legitimate rejection, not an activation failure.

## Behavioral changes

- Validation and test reports distinguish negative scores, scores below a threshold, ambiguous sides, unavailable selected-side outcomes, and overlapping entry windows. A missing selected-side outcome cannot invent a busy interval based on the opposite side's closure; any candidate missing validation/test outcomes cannot be promoted.
- `AI Missed Opportunities` rechecks archived predictions against a locally saved validated model before counting a blocked choice. Untrained WAIT counterfactuals and unverified imported model claims no longer masquerade as AI predictions. A safety rejection without an observed paper position is counted as `UNOBSERVED` and excluded from win-rate statistics. CSV export retains all fields from observed and unobserved rows. The training card shows independent opportunities and excluded observation gaps.
- Earlier saved evaluation reports remain readable. Existing evaluated-holdout watermarks and live model identifiers are retained. The RiskSafety preflight and decision checks, chronological holdouts, and no-quote-gap labeling policy remain mandatory.

## Limits

An Android WebView cannot infer quote paths when the app was not observing prices. Closing/backgrounding the app may censor paper outcomes. The UI says that the app must remain visible for continued collection. A source OHLC gap still blocks unsafe live signals until enough confirmed candles arrive. This release does not convert observed paper outcomes into broker fills or claim that the supplied gold data demonstrates an edge.
