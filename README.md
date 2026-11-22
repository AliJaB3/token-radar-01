# Token Radar

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

The radar includes 198 records that carry no token identifiers and pass observable product and naming exclusions, including all 40 watchlist records. Parent relationships are absent from the snapshot, so discoveries outside the authoritative watchlist remain provisional. Token-recorded records have their own market-data view.

Farm plans use each record's category to identify relevant review steps and risk types. Actions are conditional on finding verified project-owned documentation; unsupported routes remain research-only. No deposit size is recommended. Gas, app fees, minimums, eligibility, rewards and capital at risk are unknown where the snapshot provides no evidence; time estimates are planning estimates. The snapshot supplies no asset lists, app actions, program terms, launch probability, safety assessment, or reward evidence. TVL can overlap across protocols and chains; the snapshot has no parent/dependency map to identify or quantify those relationships, so TVL sums are not unique capital. No project-specific relationship is inferred.

## Verification

Run `node tests/model.test.ts`, `node tests/output.test.ts`, and `node tests/capture.mjs`. The capture script exercises the new sections, preserves the three screenshot names (`1-board`, `2-detail`, `3-filtered`), checks offline/mobile behavior, then performs the full build and canonical dossier comparison.
