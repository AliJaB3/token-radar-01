import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { snapshotText } from './snapshot.mjs';
import { buildBoard, eligible, liveProtocols, parseSnapshot, validateHeldOut, type Protocol, type Snapshot } from '../lib/model.ts';
import { calculateRadarValue, calculateScenario, compareValuation } from '../dashboard/00-valuation.js';

const snapshot=parseSnapshot(snapshotText);
const result=buildBoard(snapshot);

test('scores the sealed snapshot without losing watchlist or eligible records',()=>{
  assert.equal(snapshot.protocols.length,758);
  assert.equal(snapshot.watchlist.length,40);
  assert.equal(result.eligible_count,198);
  assert.equal(result.rows.length,198);
  const slugs=new Set(result.rows.map(r=>r.slug));
  assert.equal(slugs.size,result.rows.length);
  for(const slug of snapshot.watchlist)assert.ok(slugs.has(slug),`missing ${slug}`);
  assert.ok(result.rows.every(r=>eligible(r)));
});

test('ranks whole-dollar values monotonically with a stable slug tie-break',()=>{
  assert.ok(result.rows.every((r,i)=>r.rank===i+1&&Number.isSafeInteger(r.implied_value_usd)&&r.implied_value_usd>0));
  for(let i=1;i<result.rows.length;i++){
    const prev=result.rows[i-1]!,cur=result.rows[i]!;
    assert.ok(prev.implied_value_usd>=cur.implied_value_usd);
    if(prev.implied_value_usd===cur.implied_value_usd)assert.ok(prev.slug.localeCompare(cur.slug,'en')<=0);
  }
  assert.ok(new Set(result.rows.map(r=>r.implied_value_usd)).size>1);
});

test('all rows carry route, entry, exit and stop conditions with honest planning times and costs', () => {
  const categoryPlans = new Set<string>();
  for (const row of result.rows) {
    assert.equal(row.farm_steps.length, 4, row.slug);
    assert.ok(row.farm_steps.every(step => step.trim().length >= 20 && step.trim().length <= 600), row.slug);
    const [route, entry, exit, stop] = row.farm_steps;
    assert.match(route!, /^Identify route · 5–10 min review/);
    assert.match(entry!, /^Rehearse entry · 10–15 min review.*Live entry gas, fees and minimums are unknown/);
    assert.match(exit!, /^Rehearse exit · 10–15 min review.*Live exit gas, fees and settlement time are unknown/);
    assert.match(stop!, /^Set stop rules · 5–10 min review.*Stop if.*Eligibility and rewards are unknown/);
    assert.doesNotMatch(row.farm_steps.join(' '), /\$\d/);
    if (!row.farm_sources.length) {
      assert.match(route!, /project-owned docs/);
      categoryPlans.add(exit!);
    }
  }
  assert.ok(categoryPlans.size >= 13);
  const find = (slug: string) => result.rows.find(row => row.slug === slug)!;
  assert.match(find('steakhouse-financial').farm_steps[2]!, /Morpho V1 withdrawal queue/);
  assert.match(find('veda').farm_steps[2]!, /BoringQueue.*maturity, solver deadline and cancellation/);
  assert.match(find('usdd').farm_steps[2]!, /payback including stability fees.*collateral withdrawal/);
  assert.match(find('bittensor-dtao').farm_steps[2]!, /alpha back to TAO by unstaking/);
  assert.match(find('polymarket-international').farm_steps[3]!, /Losing shares can be worth zero/);
  assert.ok(result.rows.filter(row => row.farm_sources.length).every(row =>
    row.farm_sources.every(([label, url]) => label.length > 5 && new URL(url).protocol === 'https:')));
  const lending = result.rows.find(row => row.category === 'Lending')!;
  assert.match(lending.farm_steps[1]!, /supply without opening debt/i);
  const dex = result.rows.find(row => row.category === 'Dexs' && row.farm_sources.length === 0)!;
  assert.match(dex.farm_steps[0]!, /pool and both asset contracts.*fee tier/);
  assert.match(dex.farm_steps[2]!, /removing liquidity.*both assets/);
});

test('held-out validation has stable disjoint slug cohorts and compares peer methods with baselines',()=>{
  const validation=result.validation, rerun=validateHeldOut(snapshot), reversed=validateHeldOut({...snapshot,protocols:[...snapshot.protocols].reverse()});
  assert.deepEqual(validation,rerun);
  assert.deepEqual(validation,reversed);
  assert.equal(validation.holdout_fraction,0.2);
  assert.equal(validation.train_count+validation.holdout_count,128);
  assert.equal(validation.strategy.n,validation.holdout_count);
  assert.equal(validation.global_peer_median.n,validation.holdout_count);
  assert.equal(validation.tvl_equals_market_cap.n,validation.holdout_count);
  assert.equal(new Set([...validation.train_slugs,...validation.holdout_slugs]).size,128);
  assert.ok(validation.train_slugs.every(s=>!validation.holdout_slugs.includes(s)));
  const actual=new Set(snapshot.protocols.filter(p=>!p.gecko_id?false:p.mcap_usd!==null&&p.mcap_usd>0&&p.tvl_usd>0).map(p=>p.slug));
  assert.ok([...validation.train_slugs,...validation.holdout_slugs].every(s=>actual.has(s)));
  assert.deepEqual([validation.strategy.mae_log10,validation.global_peer_median.mae_log10,validation.tvl_equals_market_cap.mae_log10],[0.7461,0.6628,0.814]);
  assert.ok(validation.strategy.mae_log10>validation.global_peer_median.mae_log10); // Preserve and report the weaker observed model result.
  const cv=validation.training_cv;
  assert.equal(cv.fit_count,94);assert.equal(cv.validation_count,94);assert.equal(cv.folds,5);
  assert.deepEqual(cv.fold_validation_counts,[15,22,14,28,15]);
  assert.equal(cv.fold_fit_counts.length,5);
  assert.ok(cv.fold_validation_counts.every((n,i)=>n>0&&n+cv.fold_fit_counts[i]===cv.fit_count));
  assert.equal(cv.fold_validation_counts.reduce((a,b)=>a+b,0),cv.validation_count);
  assert.deepEqual([cv.category_global.mae_log10,cv.category_global.median_ape,cv.category_global.within_2x],[0.8414,0.8845,0.2447]);
  assert.deepEqual([cv.global_peer_median.mae_log10,cv.global_peer_median.median_ape,cv.global_peer_median.within_2x],[0.8132,0.8958,0.2766]);
  assert.deepEqual([cv.tvl_equals_market_cap.mae_log10,cv.tvl_equals_market_cap.median_ape,cv.tvl_equals_market_cap.within_2x],[0.9716,3.8883,0.1915]);
  assert.equal(cv.category_global.n,94);
});

test('token-recorded protocols remain out of the implied-value board',()=>{
  const live=liveProtocols(snapshot), liveSlugs=new Set(live.map(p=>p.slug));
  assert.ok(live.length>0);
  assert.ok(result.rows.every(r=>!liveSlugs.has(r.slug)));
  assert.ok(live.some(p=>p.mcap_usd!==null));
});

test('numeric model uses category peers, trims percentile tails, and treats missing inputs neutrally',()=>{
  const peer=(i:number,ratio:number):Protocol=>({slug:`peer-${i}`,name:`Peer ${i}`,category:'Lending',chains:['Test'],tvl_usd:100,change_7d:null,mcap_usd:100*ratio,listed_at:null,gecko_id:`peer-${i}`,symbol:`P${i}`});
  const target:Protocol={slug:'target',name:'Target',category:'Lending',chains:['Test'],tvl_usd:200,change_7d:null,mcap_usd:null,listed_at:null,gecko_id:null,symbol:null};
  const synthetic:Snapshot={as_of:'2026-11-14',source:'sealed test fixture',floor_usd:50_000_000,protocols:[peer(1,1),peer(2,2),peer(3,3),peer(4,4),peer(5,100),target],watchlist:['target']};
  const row=buildBoard(synthetic).rows[0]!;
  assert.equal(row.calibration_scope,'category');
  assert.equal(row.calibration_peer_count,5);
  assert.equal(row.calibration_ratio,3); // 1 and 100 are beyond interpolated 10th/90th bounds.
  assert.equal(row.change_7d,null);
  assert.equal(row.age_days,null);
  assert.equal(row.growth_multiplier,1);
  assert.equal(row.tenure_multiplier,1);
  assert.equal(row.implied_value_usd,600);
  assert.equal(row.valuation_inputs.change_7d,null);
  assert.equal(row.valuation_inputs.bounded_change_7d,null);
  assert.equal(row.valuation_inputs.listing_date,null);
  assert.equal(row.valuation_inputs.tracked_age_days,null);
  assert.equal(calculateRadarValue(row.valuation_inputs),row.implied_value_usd);
});

test('every snapshot row output is reproduced from its emitted inputs with exact rounding parity',()=>{
  for(const row of result.rows){
    const x=row.valuation_inputs;
    assert.equal(x.tvl_usd,row.tvl_usd,row.slug);
    assert.equal(x.calibration_ratio,row.calibration_ratio,row.slug);
    assert.equal(x.calibration_peer_count,row.calibration_peer_count,row.slug);
    assert.equal(x.calibration_scope,row.calibration_scope,row.slug);
    assert.equal(x.change_7d,row.change_7d,row.slug);
    assert.equal(x.listing_date,row.listed_at,row.slug);
    assert.equal(x.tracked_age_days,row.age_days,row.slug);
    assert.equal(calculateRadarValue(x),row.implied_value_usd,`valuation divergence for ${row.slug}`);
    assert.equal(row.implied_value_usd,Math.max(1,Math.round(x.tvl_usd*x.calibration_ratio*x.growth_multiplier*x.tenure_multiplier)));
  }
});

test('executable formula preserves JS half-up rounding and one-dollar floor at edge values',()=>{
  const base={calibration_ratio:1,calibration_peer_count:5,calibration_scope:'category' as const,change_7d:null,bounded_change_7d:null,growth_multiplier:1,listing_date:null,tracked_age_days:null,tenure_multiplier:1,rounding:'Math.round; minimum 1 USD' as const};
  assert.equal(calculateRadarValue({...base,tvl_usd:0.49}),1);
  assert.equal(calculateRadarValue({...base,tvl_usd:4.49}),4);
  assert.equal(calculateRadarValue({...base,tvl_usd:4.5}),5);
  assert.equal(calculateRadarValue({...base,tvl_usd:4.51}),5);
});

const enteredFarm = {
  amount: 100, days: 30, decline: 25, entryGas: 0.25, entryFee: 1.75,
  exitGas: 0.5, exitFee: 2, lossLimit: 30, exitDays: 32,
};

test('farm worksheet calculates funding, losses, exit proceeds and independent stop gates', () => {
  assert.deepEqual(calculateScenario(enteredFarm), {
    entry: 2, exit: 2.5, loss: 25, stressedLoss: 29.5,
    upfront: 102, total: 104.5, exitValue: 72.5, stranded: 102,
    uncountedEntryCosts: false, breakEven: 4.5, lossGate: true, timeGate: false,
  });
  const stops = calculateScenario({...enteredFarm, lossLimit: 29, exitDays: 30});
  assert.equal(stops.lossGate, false);
  assert.equal(stops.timeGate, true);
  assert.equal(calculateScenario({...enteredFarm, decline: 100, exitGas: 0, exitFee: 0}).exitValue, 0);
  assert.equal(calculateScenario({...enteredFarm, amount: 0, entryGas: 0.1, entryFee: 0.2,
    exitGas: 0, exitFee: 0, lossLimit: 0.3}).lossGate, true);
});

test('farm worksheet keeps zero, blank and invalid inputs distinct', () => {
  const zero = Object.fromEntries(Object.keys(enteredFarm).map(key => [key, 0]));
  const blank = Object.fromEntries(Object.keys(enteredFarm).map(key => [key, null]));
  assert.deepEqual(calculateScenario(zero), {
    entry: 0, exit: 0, loss: 0, stressedLoss: 0, upfront: 0, total: 0, exitValue: 0,
    stranded: 0, uncountedEntryCosts: false, breakEven: null, lossGate: true, timeGate: true,
  });
  assert.deepEqual(calculateScenario(blank), {
    entry: null, exit: null, loss: null, stressedLoss: null, upfront: null, total: null, exitValue: null,
    stranded: null, uncountedEntryCosts: true, breakEven: null, lossGate: null, timeGate: null,
  });
  const partial = calculateScenario({...enteredFarm, exitGas: null, entryFee: null, days: null});
  assert.equal(partial.total, null);
  assert.equal(partial.loss, 25);
  assert.equal(partial.stranded, 100.25);
  assert.equal(partial.uncountedEntryCosts, true);
  assert.equal(partial.timeGate, null);
  assert.match(calculateScenario({...enteredFarm, amount: -1}).error!, /USD inputs/);
  assert.match(calculateScenario({...enteredFarm, days: 2.5}).error!, /whole, non-negative/);
  assert.match(calculateScenario({...enteredFarm, exitDays: -1}).error!, /whole, non-negative/);
  assert.match(calculateScenario({...enteredFarm, decline: 101}).error!, /0% to 100%/);
  assert.match(calculateScenario({...enteredFarm, entryGas: NaN}).error!, /USD inputs/);
  assert.match(calculateScenario({...enteredFarm, lossLimit: Infinity}).error!, /USD inputs/);
});

test('comparison variants share the executable formula and preserve all frozen board and validation outputs', () => {
  const base = {tvlChange: 0, useGlobal: false, useGrowth: true, useTracking: true};
  const before = JSON.stringify(result);
  for (const row of result.rows) {
    const x = row.valuation_inputs;
    const same = compareValuation(x, result.calibration_ratio, base);
    assert.equal(same.value, row.implied_value_usd, row.slug);
    assert.equal(same.delta, 0);
    const stress = compareValuation(x, result.calibration_ratio,
      {tvlChange: -25, useGlobal: true, useGrowth: false, useTracking: false});
    const expected = Math.max(1, Math.round(x.tvl_usd * 0.75 * result.calibration_ratio));
    assert.equal(stress.value, expected);
    assert.equal(stress.delta, expected - row.implied_value_usd);
    assert.equal(compareValuation(x, result.calibration_ratio, {...base, tvlChange: -100}).value, 1);
    assert.match(compareValuation(x, result.calibration_ratio, {...base, tvlChange: null}).error!, /Enter a TVL change/);
    for (const tvlChange of [-101, 1001, NaN, Infinity]) {
      assert.match(compareValuation(x, result.calibration_ratio, {...base, tvlChange}).error!, /must be from/);
    }
  }
  assert.equal(JSON.stringify(result), before);
  const rows = result.rows.map(({slug, rank, implied_value_usd, valuation_inputs}) =>
    ({slug, rank, implied_value_usd, valuation_inputs}));
  const frozenDigest = createHash('sha256').update(JSON.stringify({rows, validation: result.validation})).digest('hex');
  assert.equal(frozenDigest, '58ae96f9cb5d6c197ee780683c7466dec43a192294fef55552ed10199f03d0db',
    'ranks, values, valuation inputs and validation match the v5 baseline artifact');
});

test('growth bounds and tracking-age arithmetic are deterministic',()=>{
  const r=buildBoard(snapshot).rows.find(x=>x.change_7d!==null&&x.listed_at!==null)!;
  const expectedAge=Math.max(0,Math.floor((Date.parse(`${snapshot.as_of}T00:00:00Z`)-Date.parse(`${r.listed_at}T00:00:00Z`))/86_400_000));
  assert.equal(r.age_days,expectedAge);
  assert.ok(r.growth_multiplier>=0.875&&r.growth_multiplier<=1.25);
  assert.ok(r.tenure_multiplier>=0.85&&r.tenure_multiplier<=1);
  assert.ok(r.implied_value_usd<=100_000_000_000_000);
  const extreme={...snapshot,protocols:snapshot.protocols.map(p=>p.slug===r.slug?{...p,change_7d:10000}:p)};
  assert.equal(buildBoard(extreme).rows.find(x=>x.slug===r.slug)?.growth_multiplier,1.25);
  const negative={...snapshot,protocols:snapshot.protocols.map(p=>p.slug===r.slug?{...p,change_7d:-10000}:p)};
  assert.equal(buildBoard(negative).rows.find(x=>x.slug===r.slug)?.growth_multiplier,0.875);
});

test('missing comparable data fails instead of inventing a calibration anchor',()=>{
  const only:Protocol={slug:'only',name:'Only',category:null,chains:[],tvl_usd:100,change_7d:null,mcap_usd:null,listed_at:null,gecko_id:null,symbol:null};
  assert.throws(()=>buildBoard({as_of:'2026-11-14',source:'test',floor_usd:0,protocols:[only],watchlist:['only']}),/no token-recorded market-cap\/TVL comparables/);
});
