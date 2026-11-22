# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/AliJaB3/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/AliJaB3/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Independent English-only static research dashboard for the sealed token-radar-01 snapshot. Production runs on Node 22.18+ using its standard library and the exact kit vendor library.

## Commands

The authentic kit snapshot is external and must not be copied into this repository. Developer tests and the capture script read `RADAR_SNAPSHOT`, falling back to `/root/.hermes/cache/scratch/token-radar-work/token-radar-01-kit/input/snapshot.json` when unset or empty. They fail with an actionable error if that file is unavailable. To use another kit location, set `RADAR_SNAPSHOT` to its original `input/snapshot.json`.

```sh
export RADAR_SNAPSHOT="${RADAR_SNAPSHOT:-/root/.hermes/cache/scratch/token-radar-work/token-radar-01-kit/input/snapshot.json}"
node tests/model.test.ts
node tests/output.test.ts
node main.ts --input "$RADAR_SNAPSHOT" --output out --preview
node tests/capture.mjs
node main.ts --input "$RADAR_SNAPSHOT" --output out
```

Open `out/dashboard/index.html` directly from disk. No server or network is needed. The capture script uses an installed Playwright module; set `PLAYWRIGHT_MODULE` if its path differs. It renders and tests the actual generated page offline, creates the three screenshots, closes the browser, and then performs a full build. `--preview` explicitly omits dossier generation; the normal build requires real screenshots and fails if they are missing.

The scorer's default invocation reads `/input/snapshot.json` and writes `/output`; `--input`, `--output`, and `MAKEFUN_OUTPUT_DIR` support local use.

## Dashboard sections

Board preserves the radar and token-recorded market view. Liquidity searches, filters, sorts and opens details for all 758 snapshot records; TVL is protocol TVL, not DEX pool liquidity or executable depth, and values can overlap. Launch shows all 198 radar records with category/search filters, sorting and detail cards. These are snapshot records without token fields, not upcoming launches or verified airdrops. Charts show category TVL sums, the distribution of reported 7-day TVL changes, and the largest snapshot records. They are cross-sectional views from one date, not time series.

All sections are English-only, offline and filterable where applicable. The snapshot supplies TVL, 7-day TVL change, listing date, chains, category, symbol, token identifier and market cap only. It has no pair liquidity, price/OHLCV history, actual token launch dates, live feeds, verified airdrops, fees or volume. Listing dates are tracking metadata, not token launch dates; absent token fields do not prove that a project has no token. The displayed snapshot date is the source date.

## Model

The displayed board anchor is a median market-cap/TVL ratio from snapshot records with a token identifier and positive market cap and TVL. A target uses same-category peers when at least five are available; otherwise it uses the global peer set. The 10th–90th percentile tails are excluded with linearly interpolated percentile bounds. The output is TVL × anchor × growth × listing-tenure proxy. Growth is clamped at −50% to +100% with weight 0.25. The proxy rises from 0.85 to 1 over 730 days based on the source tracking date. Missing change and listing date use neutral factors. This is not time without a token: the snapshot cannot measure that. These coefficients are assumptions, not measured launch outcomes. No-peer snapshots fail explicitly instead of receiving an invented fallback ratio.

### Held-out check (snapshot dated 2026-11-14)

To check whether the core TVL × peer-ratio calibration reconstructs *listed market cap*, token-recorded rows with a token identifier and positive market cap and TVL are assigned by slug before fitting: FNV-1a over the slug's UTF-16 code units, unsigned 32-bit result modulo 5 equals 0 for holdout (nominal 20%). This gives 94 training and 34 held-out comparables. All category and global ratios, including percentile trimming, are fit from training rows only. For each held-out row, predict TVL × category training median when that category has at least five training peers, else TVL × global training median. Compare with two baselines: TVL itself (ratio 1) and TVL × the training-only global peer median. Report mean absolute log10 error, median absolute percentage error (APE), and fraction within a factor of two. Slug cohorts are emitted with the results for auditability; the split is independent of source order and repeatable offline.

Measured results from the authentic kit snapshot: 34 holdout rows; category/global method MAE 0.7461 log10 units, median APE 93.75%, within 2× 20.59%; global peer-median baseline 0.6628, 86.87%, 32.35%; TVL-equals-market-cap baseline 0.8140, 228.42%, 20.59%. Thus the category/global method underperforms the simpler global peer baseline on this holdout. This is an evaluation of same-date listed market-cap reconstruction only, not a launch-valuation or future-return test. It evaluates the TVL × calibration component; growth and listing-tenure adjustments are assumptions and are not validated here. Listed token market caps are not launch valuations. The sample is small, cross-sectional, selected from protocols with usable token identifiers, positive TVL and positive market cap, and has no launch outcomes, token supply/unlocks, revenue, price history or time series. Do not read these metrics as precision for tokenless candidates.

Model selection check, performed without using the outer holdout: the 94 training rows were assigned by deterministic FNV-1a of `cv:` plus slug modulo 5, independent of the outer hash split. All five folds were nonempty (15, 22, 14, 28, 15 validation rows) and gave 94 out-of-fold predictions. Category/global scored MAE 0.8414, median APE 88.45%, within 2× 24.47%; global-only 0.8132, 89.58%, 27.66%; TVL-only 0.9716, 388.83%, 19.15%. CV is mixed: category/global is slightly better on median APE and within 2×, while global-only has lower mean log error. The separate outer holdout favors global-only on all three metrics, but was not used to select a replacement. With this small selected sample and no clear training-CV winner, the board model is unchanged and both results are reported. Neither split validates launches or future performance.

The radar contains 198 records: all 40 entries in the snapshot's authoritative watchlist plus 158 additional discoveries. The dashboard shows 40/40 coverage and opens the searchable official set directly. The official set is exactly the snapshot `watchlist` field, not a broader inferred count. Radar inclusion requires absent token identifier fields and applies generic exclusions for versioned names, selected categories (including Bridge and Liquid Staking), wrapped/staked names, and selected exchange names. WBTC is categorized Bridge; Binance staked ETH is categorized Liquid Staking and has a staked name marker. These are rule applications to recorded fields only; no project-specific parent or dependency relationship is inferred. Discoveries outside the official set remain provisional. Token-recorded records have their own market-data view.

Farm plans use the recorded category for concrete review prompts and risk types. Each step gives an estimated time and labels unsupported costs unknown. The detail card cites snapshot source and date and states that project documentation was not checked. Actions require later verification; unsupported routes stay research-only. No deposit size is recommended. Eligibility, rewards and capital at risk are unknown. The snapshot supplies no asset lists, app actions, program terms, launch probability, safety assessment, or reward evidence. TVL can overlap across protocols and chains; the snapshot has no parent/dependency map, so sums are not unique capital. No project-specific relationship is inferred.

## Verification

Run `node tests/model.test.ts`, `node tests/output.test.ts`, and `node tests/capture.mjs`. The capture script exercises the new sections, preserves the three screenshot names (`1-board`, `2-detail`, `3-filtered`), checks offline/mobile behavior, then performs the full build and canonical dossier comparison.
