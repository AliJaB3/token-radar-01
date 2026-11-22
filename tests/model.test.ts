import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotText } from './snapshot.mjs';
import { buildBoard, eligible, liveProtocols, parseSnapshot, validateHeldOut, type Protocol, type Snapshot } from '../lib/model.ts';
import { calculateRadarValue } from '../dashboard/00-valuation.js';

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

test('farm plans give bounded concrete category research tasks without asserting live activity',()=>{
  for(const row of result.rows){
    assert.equal(row.farm_steps.length,4,row.slug);
    for(const step of row.farm_steps){assert.ok(step.trim().length>=40&&step.trim().length<=450,row.slug);assert.match(step,/Planning time estimate:/);assert.match(step,/unknown/i);}
    assert.match(row.farm_steps[2]!,/No live program or reward is established/);
    assert.doesNotMatch(row.farm_steps.join(' '),/\$(?!0\b)\d/);
    assert.match(row.farm_steps[0]!,/official project docs.*compare the domain and chain.*Record both links/i);
  }
  const lending=result.rows.find(r=>r.category?.toLowerCase().includes('lend'));
  const dex=result.rows.find(r=>r.category?.toLowerCase().includes('dex'));
  if(lending)assert.match(lending.farm_steps[1]!,/collateral factor, oracle, liquidation threshold, and withdrawal conditions/);
  if(dex)assert.match(dex.farm_steps[1]!,/pool and both assets.*fee tier, pool depth, exit steps/);
  assert.ok(result.rows.some(r=>r.farm_steps[1]!==lending?.farm_steps[1]),'category plans differ for actual snapshot categories');
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
