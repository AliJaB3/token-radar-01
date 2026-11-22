/** Snapshot-only launch radar. All market anchors come from token-bearing rows in this file. */
import { calculateRadarValue } from '../dashboard/00-valuation.js';
export type Protocol = { slug:string; name:string; category:string|null; chains:string[]; tvl_usd:number; change_7d:number|null; mcap_usd:number|null; listed_at:string|null; gecko_id:string|null; symbol:string|null };
export type Snapshot = { as_of:string; source:string; floor_usd:number; protocols:Protocol[]; watchlist:string[] };
export type ValuationInputs={tvl_usd:number;calibration_ratio:number;calibration_peer_count:number;calibration_scope:'category'|'all-token-recorded';change_7d:number|null;bounded_change_7d:number|null;growth_multiplier:number;listing_date:string|null;tracked_age_days:number|null;tenure_multiplier:number;rounding:'Math.round; minimum 1 USD'};
export type Row = Protocol & { rank:number; token_status:'unrecorded'; age_days:number|null; implied_value_usd:number; calibration_ratio:number; calibration_peer_count:number; calibration_scope:'category'|'all-token-recorded'; growth_multiplier:number; tenure_multiplier:number; valuation_inputs:ValuationInputs; farm_steps:string[]; valuation_note:string };
export type ValidationMetrics={n:number;mae_log10:number;median_ape:number;within_2x:number};
export type TrainingValidation={split:string;folds:number;fit_count:number;validation_count:number;fold_validation_counts:number[];fold_fit_counts:number[];category_global:ValidationMetrics;global_peer_median:ValidationMetrics;tvl_equals_market_cap:ValidationMetrics};
export type HeldOutValidation={split:string;holdout_fraction:number;train_count:number;holdout_count:number;train_slugs:string[];holdout_slugs:string[];strategy:ValidationMetrics;global_peer_median:ValidationMetrics;tvl_equals_market_cap:ValidationMetrics;training_cv:TrainingValidation};
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const DAY = 86_400_000;
export function ageDays(asOf:string, listedAt:string|null):number|null {
  if (!listedAt) return null;
  const a=Date.parse(`${asOf}T00:00:00Z`), b=Date.parse(`${listedAt}T00:00:00Z`);
  return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.floor((a-b)/DAY)):null;
}
export function isUnrecorded(p:Protocol):boolean { return p.gecko_id===null&&p.symbol===null; }
export function eligible(p:Protocol):boolean {
  return isUnrecorded(p)&&!VERSIONED.test(p.name)
    &&!['Bridge','Canonical Bridge','Liquid Staking','Liquid Restaking','Restaked BTC','CEX'].includes(p.category??'')
    &&!/\b(wrapped|staked|staking)\b/i.test(p.name)
    &&!/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i.test(p.name);
}
function median(xs:number[]):number { const a=[...xs].sort((x,y)=>x-y), m=a.length>>1; return a.length%2?a[m]!:(a[m-1]!+a[m]!)/2; }
function quantile(sorted:number[],q:number):number { const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos); return sorted[lo]!+(sorted[hi]!-sorted[lo]!)*(pos-lo); }
function calibrationPeers(snapshot:Snapshot):Map<string,number[]> {
  const peers=new Map<string,number[]>();
  for(const p of snapshot.protocols){
    if(isUnrecorded(p)||!p.gecko_id||p.mcap_usd===null||p.mcap_usd<=0||p.tvl_usd<=0)continue;
    const ratio=p.mcap_usd/p.tvl_usd;
    if(!Number.isFinite(ratio)||ratio<=0)continue;
    for(const key of ['*',p.category?.toLowerCase()??''])if(key){const values=peers.get(key)??[];values.push(ratio);peers.set(key,values);}
  }
  return peers;
}
function heldOut(slug:string):boolean {
  // Fixed FNV-1a assignment: stable across runtimes, ordering, and repeated builds.
  let h=2166136261;for(let i=0;i<slug.length;i++){h^=slug.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0)%5===0;
}
function slugHash(slug:string):number {
  let h=2166136261;for(let i=0;i<slug.length;i++){h^=slug.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;
}
function calibration(values:number[]):number {
  if(!values.length)throw new Error('Cannot value the radar: snapshot has no token-recorded market-cap/TVL comparables.');
  const sorted=[...values].sort((a,b)=>a-b), lo=quantile(sorted,0.1), hi=quantile(sorted,0.9);
  return median(sorted.filter(x=>x>=lo&&x<=hi));
}
function metric(actual:number[],predicted:number[]):ValidationMetrics {
  const errors=actual.map((v,i)=>Math.abs(Math.log10(predicted[i]!)-Math.log10(v))).sort((a,b)=>a-b);
  const ape=actual.map((v,i)=>Math.abs(predicted[i]!-v)/v).sort((a,b)=>a-b);
  const mid=(x:number[])=>x.length%2?x[x.length>>1]!:(x[(x.length>>1)-1]!+x[x.length>>1]!)/2;
  return {n:actual.length,mae_log10:+(errors.reduce((a,b)=>a+b,0)/errors.length).toFixed(4),median_ape:+mid(ape).toFixed(4),within_2x:+(actual.filter((v,i)=>Math.max(v/predicted[i]!,predicted[i]!/v)<=2).length/actual.length).toFixed(4)};
}
export function validateHeldOut(snapshot:Snapshot):HeldOutValidation {
  const peers=snapshot.protocols.filter(p=>!isUnrecorded(p)&&!!p.gecko_id&&p.mcap_usd!==null&&p.mcap_usd>0&&p.tvl_usd>0);
  const train=peers.filter(p=>!heldOut(p.slug)),holdout=peers.filter(p=>heldOut(p.slug));
  if(!train.length||!holdout.length)throw new Error('Held-out validation requires token-recorded training and holdout records.');
  const global=calibration(train.map(p=>p.mcap_usd!/p.tvl_usd));
  const actual:number[]=[],strategy:number[]=[],globalBase:number[]=[],tvlBase:number[]=[];
  for(const p of holdout){
    const category=train.filter(t=>(t.category??'').toLowerCase()===(p.category??'').toLowerCase());
    const ratio=category.length>=5?calibration(category.map(t=>t.mcap_usd!/t.tvl_usd)):global;
    actual.push(p.mcap_usd!);strategy.push(p.tvl_usd*ratio);globalBase.push(p.tvl_usd*global);tvlBase.push(p.tvl_usd);
  }
  // Select among peer methods using only the outer training set, with deterministic OOF folds.
  const cvActual:number[]=[],cvCategory:number[]=[],cvGlobal:number[]=[],cvTvl:number[]=[],fold_validation_counts:number[]=[],fold_fit_counts:number[]=[];
  for(let fold=0;fold<5;fold++){
    const cvFit=train.filter(p=>slugHash(`cv:${p.slug}`)%5!==fold),cvCheck=train.filter(p=>slugHash(`cv:${p.slug}`)%5===fold);
    if(!cvFit.length||!cvCheck.length)continue;
    fold_validation_counts.push(cvCheck.length);fold_fit_counts.push(cvFit.length);
    const cvGlobalRatio=calibration(cvFit.map(p=>p.mcap_usd!/p.tvl_usd));
    for(const p of cvCheck){
      const peersInCategory=cvFit.filter(t=>(t.category??'').toLowerCase()===(p.category??'').toLowerCase());
      const categoryRatio=peersInCategory.length>=5?calibration(peersInCategory.map(t=>t.mcap_usd!/t.tvl_usd)):cvGlobalRatio;
      cvActual.push(p.mcap_usd!);cvCategory.push(p.tvl_usd*categoryRatio);cvGlobal.push(p.tvl_usd*cvGlobalRatio);cvTvl.push(p.tvl_usd);
    }
  }
  const training_cv:TrainingValidation={split:'Nested in outer train; FNV-1a("cv:" + slug) mod 5; each row predicted out of fold',folds:5,fit_count:train.length,validation_count:cvActual.length,fold_validation_counts,fold_fit_counts,category_global:metric(cvActual,cvCategory),global_peer_median:metric(cvActual,cvGlobal),tvl_equals_market_cap:metric(cvActual,cvTvl)};
  return {split:'FNV-1a(slug) mod 5 = 0; assigned before fitting',holdout_fraction:0.2,train_count:train.length,holdout_count:holdout.length,train_slugs:train.map(p=>p.slug).sort(),holdout_slugs:holdout.map(p=>p.slug).sort(),strategy:metric(actual,strategy),global_peer_median:metric(actual,globalBase),tvl_equals_market_cap:metric(actual,tvlBase),training_cv};
}
function farmPlan(p:Protocol):string[] {
  const c=(p.category??'').toLowerCase();
  const activity = c.includes('lend')||c.includes('cdp')||c.includes('collateral') ? 'For lending: locate the documented supply market; write down asset, collateral factor, oracle, liquidation threshold, and withdrawal conditions. Do not borrow.'
  : c.includes('dex')||c.includes('liquidity manager')||c==='farm' ? 'For a DEX: identify a documented pool and both assets; check fee tier, pool depth, exit steps, and impermanent-loss exposure before considering liquidity.'
  : c.includes('yield')||c.includes('vault')||c.includes('curator')||c.includes('allocator')||c.includes('leveraged farming') ? 'For a vault: list the strategy, underlying protocols, curator permissions, withdrawal queue, and loss conditions. Skip leverage unless independently understood.'
  : c.includes('derivative')||c.includes('perpetual')||c.includes('basis') ? 'For derivatives: record the settlement asset, funding calculation, fees, liquidation trigger, and close position path. Stop if loss limits are unclear.'
  : c.includes('bridge') ? 'For a bridge: verify source and destination networks, exact assets, finality, recovery route, and test-transfer support. Never scale an unverified route.'
  : c.includes('staking')||c.includes('restak')||c.includes('anchor btc')||c.includes('decentralized btc') ? 'For staking: check validator/custody model, slashing, unbonding delay, and queue status. Do not use funds needed before the full exit period.'
  : c.includes('stable') ? 'For a stable asset: identify collateral, peg mechanism, redemption conditions, and pause controls; check how redemption works during a depeg.'
  : c.includes('rwa') ? 'For an RWA: locate issuer and backing evidence, jurisdiction limits, investor eligibility, redemption terms, and transfer restrictions.'
  : c.includes('prediction') ? 'For prediction markets: record the resolution oracle, dispute window, trading fees, position exit route, and any eligibility rules.'
  : c.includes('insurance') ? 'For insurance: compare covered events with exclusions; identify capital backing, claim evidence required, and the claims payout process.'
  : c.includes('chain') ? 'For a chain: check official docs for a verifiable testnet or low-risk user action, prerequisites, supported wallet, and whether it is reversible.'
  : c.includes('payment')||c.includes('crypto card') ? 'For payments: verify supported region and assets, conversion and card fees, custody, refund handling, and failed-payment reversal steps.'
  : c.includes('governance') ? 'For governance: check who can vote, quorum, proposal rules, execution authority, and any required voting power or transaction fee.'
  : c.includes('index') ? 'For an index: list constituents, rebalance rules, tracking method, redemption terms, and concentration or tracking-error risks.'
  : c.includes('otc') ? 'For OTC: verify counterparty identity, settlement asset, escrow, dispute route, and reversibility from project-owned documents.'
  : 'For this category: use project-owned docs to identify one real action, prerequisites, reversibility, and exit route; if none is documented, stay research-only.';
  return [
    `Find the official project docs from a verified project-owned domain; compare the domain and chain against a second project-owned page. Record both links. Planning time estimate: 10–15 min. Cost, gas and protocol fees: unknown.`,
    `${activity} This is a review task, not a claim that the route exists. Planning time estimate: 15–25 min. Minimums, gas and protocol fees: unknown.`,
    `Check official announcements and terms for documented eligibility, dates, and claim steps. No live program or reward is established by this snapshot; if no terms exist, skip this step. Planning time estimate: 5–10 min. Eligibility, reward and claim gas: unknown.`,
    `Before any optional action, confirm network, asset, approvals, quoted fees, withdrawal path, and your own loss limit on the final confirmation screen; stop if any field differs from official docs. Save the source and transaction link. Planning time estimate: 5–10 min. Current gas and protocol fees: unknown. No deposit is recommended.`,
  ];
}
export function buildBoard(snapshot:Snapshot):{rows:Row[]; calibration_ratio:number; calibration_peer_count:number; eligible_count:number;validation:HeldOutValidation} {
  const bySlug=new Map(snapshot.protocols.map(p=>[p.slug,p]));
  const candidates=snapshot.protocols.filter(eligible);
  const picked=new Map(candidates.map(p=>[p.slug,p]));
  for(const slug of snapshot.watchlist){const p=bySlug.get(slug);if(p)picked.set(slug,p);}
  const peers=calibrationPeers(snapshot), globalPeers=peers.get('*')??[], ratio=calibration(globalPeers), rows=[...picked.values()].map(p=>{
    const age=ageDays(snapshot.as_of,p.listed_at), g=p.change_7d;
    const bounded=g===null?0:Math.max(-50,Math.min(100,g));
    const growth=1+bounded/100*0.25;
    const tenure=age===null?1:0.85+0.15*Math.min(age,730)/730;
    const comparable=peers.get(p.category?.toLowerCase()??'')??[], scoped=comparable.length>=5?comparable:globalPeers, anchor=calibration(scoped), scope=comparable.length>=5?'category' as const:'all-token-recorded' as const;
    const valuation_inputs:ValuationInputs={tvl_usd:p.tvl_usd,calibration_ratio:anchor,calibration_peer_count:scoped.length,calibration_scope:scope,change_7d:g,bounded_change_7d:g===null?null:bounded,growth_multiplier:growth,listing_date:p.listed_at,tracked_age_days:age,tenure_multiplier:tenure,rounding:'Math.round; minimum 1 USD'};
    const value=calculateRadarValue(valuation_inputs);
    return {...p,rank:0,token_status:'unrecorded' as const,age_days:age,implied_value_usd:value,calibration_ratio:anchor,calibration_peer_count:scoped.length,calibration_scope:scope,growth_multiplier:+growth.toFixed(4),tenure_multiplier:+tenure.toFixed(4),valuation_inputs,farm_steps:farmPlan(p),valuation_note:`TVL × ${scope==='category'?'category':'global'} peer median market-cap/TVL (${anchor.toFixed(4)}; ${scoped.length} usable peers, 10th–90th percentile tails excluded) × growth (${growth.toFixed(4)}) × tracked-listing-tenure proxy (${tenure.toFixed(4)}), then Math.round with 1 USD minimum. Tracking age is not tokenless age.`};
  });
  rows.sort((a,b)=>b.implied_value_usd-a.implied_value_usd||a.slug.localeCompare(b.slug,'en'));
  rows.forEach((r,i)=>r.rank=i+1);
  return {rows,calibration_ratio:ratio,calibration_peer_count:globalPeers.length,eligible_count:candidates.length,validation:validateHeldOut(snapshot)};
}
export function parseSnapshot(text:string):Snapshot {
 const s=JSON.parse(text) as Snapshot;
 if(!s||!Array.isArray(s.protocols)||!Array.isArray(s.watchlist)||typeof s.as_of!=='string')throw new Error('Invalid snapshot shape');
 return s;
}
export function liveProtocols(snapshot:Snapshot):Protocol[] { return snapshot.protocols.filter(p=>!isUnrecorded(p)).sort((a,b)=>(b.mcap_usd??0)-(a.mcap_usd??0)||b.tvl_usd-a.tvl_usd); }
