/** Snapshot-only launch radar. All market anchors come from token-bearing rows in this file. */
export type Protocol = { slug:string; name:string; category:string|null; chains:string[]; tvl_usd:number; change_7d:number|null; mcap_usd:number|null; listed_at:string|null; gecko_id:string|null; symbol:string|null };
export type Snapshot = { as_of:string; source:string; floor_usd:number; protocols:Protocol[]; watchlist:string[] };
export type Row = Protocol & { rank:number; token_status:'unrecorded'; age_days:number|null; implied_value_usd:number; calibration_ratio:number; calibration_peer_count:number; calibration_scope:'category'|'all-token-recorded'; growth_multiplier:number; tenure_multiplier:number; farm_steps:string[]; valuation_note:string };
export type ValidationMetrics={n:number;mae_log10:number;median_ape:number;within_2x:number};
export type HeldOutValidation={split:string;holdout_fraction:number;train_count:number;holdout_count:number;train_slugs:string[];holdout_slugs:string[];strategy:ValidationMetrics;global_peer_median:ValidationMetrics;tvl_equals_market_cap:ValidationMetrics};
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
  return {split:'FNV-1a(slug) mod 5 = 0; assigned before fitting',holdout_fraction:0.2,train_count:train.length,holdout_count:holdout.length,train_slugs:train.map(p=>p.slug).sort(),holdout_slugs:holdout.map(p=>p.slug).sort(),strategy:metric(actual,strategy),global_peer_median:metric(actual,globalBase),tvl_equals_market_cap:metric(actual,tvlBase)};
}
function farmPlan(p:Protocol):string[] {
  const c=(p.category??'').toLowerCase();
  const activity = c.includes('lend')||c.includes('cdp')||c.includes('collateral') ? `Review any documented supply markets, collateral factors, oracle design and withdrawal rules. Only use a verified market you understand; liquidation, bad debt and paused withdrawals are risks. Borrowing is optional and adds repayment risk.`
  : c.includes('dex')||c.includes('liquidity manager')||c==='farm' ? `Review any documented pool assets, fee mechanics, withdrawal path and impermanent-loss exposure. Only use a verified pool you understand; price divergence, thin liquidity and contract risk can exceed fees earned.`
  : c.includes('yield')||c.includes('vault')||c.includes('curator')||c.includes('allocator')||c.includes('leveraged farming') ? `Review any documented strategy, underlying protocols, curator permissions and exit terms. Avoid leverage unless independently understood; strategy loss, dependency failure and delayed exits are risks.`
  : c.includes('derivative')||c.includes('perpetual')||c.includes('basis') ? `Review market mechanics, funding or settlement rules, fees and liquidation conditions. Derivatives can lose the full position quickly; skip participation if loss limits and settlement are unclear.`
  : c.includes('bridge') ? `Review a documented route, source and destination assets, finality assumptions and recovery process. Bridge exploits, wrong-network transfers and delayed recovery are risks; do not scale a test.`
  : c.includes('staking')||c.includes('restak')||c.includes('anchor btc')||c.includes('decentralized btc') ? `Review staking or BTC-collateral design, validator or custody assumptions, slashing terms and unbonding queue. Slashing, custody failure and locked funds are risks; only commit assets you can leave locked.`
  : c.includes('stable') ? `Review collateral composition, peg mechanism, redemption path and failure modes. Depeg, collateral impairment and redemption pauses are risks; a stable label does not guarantee principal.`
  : c.includes('rwa') ? `Check issuer, backing, eligibility, redemption terms and jurisdiction limits in project-owned documents. Legal restrictions, issuer default and illiquidity are risks; do not deposit unless eligible.`
  : c.includes('prediction') ? `Review resolution source, dispute window, trading fees and eligibility rules before taking a position. Ambiguous resolution, thin markets and total position loss are risks.`
  : c.includes('insurance') ? `Review covered events, exclusions, capital backing, claim evidence and payout process. Exclusions, disputed claims and insufficient backing are risks; buy cover only for a real exposure.`
  : c.includes('chain') ? `Use project-owned docs to identify a low-risk, verifiable network action and its required wallet or assets. Validator, bridge and transaction risks depend on the actual action; do not infer a reward.`
  : c.includes('payment')||c.includes('crypto card') ? `Review fees, supported assets, availability, custody and reversal rules for any documented payment flow. Custody, conversion and failed-reversal risks apply; availability may be restricted.`
  : c.includes('governance') ? `Review governance rules, proposal requirements and participation costs. Check voting power, quorum and execution authority; a vote may have no effect and participation may cost gas.`
  : c.includes('index') ? `Review constituents, rebalancing rules, tracking method and redemption costs for any documented product. Concentration, tracking error and redemption delays are risks.`
  : c.includes('otc') ? `Verify counterparty, settlement asset, escrow terms and dispute path from project-owned documents. Counterparty default and irreversible settlement are risks; avoid off-platform settlement.`
  : `Use project-owned docs to identify a real user action, prerequisites, reversibility and exit path. Contract, custody and exit risks are unknown; if no useful action is documented, keep this research-only.`;
  return [
    `Confirm the project domain and chain from two official project-owned sources before connecting a wallet. Cost estimate: $0. Time estimate: 10–15 minutes.`,
    `Create a dedicated wallet, write down its address, and keep the seed phrase offline; do not reuse a wallet holding long-term funds. Cost estimate: $0. Time estimate: 5–10 minutes.`,
    `${activity} No deposit size is recommended. Minimums, gas, app fees and capital at risk: unknown until an actual route and asset are verified. Time estimate: 20–40 minutes to inspect a route; no action is required.`,
    `If the verified app offers a useful repeat action and fees are acceptable, do it once on a later week and retain transaction links; avoid wash activity or self-trading. Cost estimate: unknown until the chain and transaction are known; do not assume a fee range from this snapshot. Time estimate: 5–15 minutes weekly.`,
    `Use a 4-week review window as a planning cadence, not a token-timing signal; keep only a position you independently want and set a loss limit and exit rule. The snapshot tracking date is not time without a token. Opportunity cost: capital remains exposed; rewards and eligibility are unknown. Time estimate: 5 minutes to set rules, then a weekly check.`,
    `Before withdrawing, check the project's official announcements and terms for any live points or incentive program; this snapshot does not establish one exists. Claim only through a verified official route. Cost estimate: $0 to check; claim gas is unknown. Time estimate: 10 minutes.`,
    `Log dates, amounts, fees, action types and transaction links, then withdraw when your own exit rule is met. Cost estimate: $0 plus any unwind fee, which is unknown. Time estimate: 10–20 minutes.`,
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
    const value=Math.max(1,Math.round(p.tvl_usd*anchor*growth*tenure));
    return {...p,rank:0,token_status:'unrecorded' as const,age_days:age,implied_value_usd:value,calibration_ratio:anchor,calibration_peer_count:scoped.length,calibration_scope:scope,growth_multiplier:+growth.toFixed(4),tenure_multiplier:+tenure.toFixed(4),farm_steps:farmPlan(p),valuation_note:`TVL × ${scope==='category'?'category':'global'} peer median market-cap/TVL (${anchor.toFixed(4)}; ${scoped.length} usable peers, 10th–90th percentile tails excluded) × growth factor (${growth.toFixed(4)}) × listing-tenure proxy (${tenure.toFixed(4)}). The snapshot gives tracking age, not tokenless age.`};
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
