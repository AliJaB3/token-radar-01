import { documentedPlans } from '../dashboard/01-farm-plans.js';
import type { Protocol } from './model.ts';

type CategoryPlan = readonly [readonly string[], string, string, string, string];
const categoryPlans: CategoryPlan[] = [
  [["Risk Curators", "Onchain Capital Allocator", "Yield", "Yield Aggregator", "CeDeFi", "Farm"],
    "Identify one vault, its deposit asset, share token, manager and deployed strategies. Check concentration and who can change allocations.",
    "Preview deposit and resulting shares. Record the share rate, fee schedule, any cap, and a fresh redemption preview for the same shares.",
    "Distinguish immediate redeem from queue and claim. Check liquid backing, when shares stop earning and who can pause withdrawals.",
    "Stop if the share rate, manager or liquidity cannot be verified. Strategy loss can reduce share value, and a queue can lock capital."],
  [["Lending", "Uncollateralized Lending"],
    "Find a documented supply market and verify the asset, borrow collateral, oracle, bad-debt rules and who bears shortfalls.",
    "Preview supply without opening debt. Check supply cap, receipt asset or balance, and whether collateral is enabled by default.",
    "Preview withdrawing the supplied asset. Compare available cash with your withdrawal size and check utilization and pause status.",
    "Stop if cash is below your exit size or credit terms are unclear. Bad debt or asset impairment can lower recoveries."],
  [["CDP", "CDP Manager"],
    "Find the vault type and write down its collateral, debt asset, stability fee, liquidation threshold and oracle.",
    "Preview locking collateral and minting debt. Stress the collateral price and reserve the debt asset and gas needed to repay.",
    "Preview paying accrued debt, then unlocking collateral. Check redemption and liquidation conditions before relying on the exit.",
    "Stop if you cannot explain repayment after a depeg or price drop. Liquidation can take collateral and add penalties."],
  [["Dexs", "Liquidity Manager"],
    "Identify one pool and both asset contracts. Check pool price, depth, fee tier, pool version and whether liquidity uses a price range.",
    "Preview the asset split and LP receipt or NFT. Record any swap impact and minimum received before previewing the liquidity add.",
    "Preview removing liquidity and receiving both assets. Budget separate swaps if you need to return to one asset.",
    "Stop if exit depth is thin or token contracts differ. Compare the withdrawn basket against holding the same tokens, including divergence loss."],
  [["Leveraged Farming", "Basis Trading", "Derivatives", "Interest Rate Derivatives"],
    "Identify margin asset, exposure on each leg, funding or rate settlement, oracle and liquidation conditions.",
    "Simulate both legs at your size and calculate margin after adverse funding, spread widening and a price move.",
    "Preview reducing exposure on each leg and redeeming remaining margin. Check settlement time and what happens if only one leg closes.",
    "Stop if the hedge can break or collateral can be liquidated before you exit. Include margin loss, adverse funding and close fees."],
  [["RWA"],
    "Verify issuer, asset backing, legal claim, transfer rules and whether access requires onboarding.",
    "Preview subscription with the documented settlement asset. Note minimums, NAV cut-off, custody and fees.",
    "Work backward from cash settlement. Check redemption windows, notice, gates and whether a secondary exit is permitted.",
    "Stop if the claim or eligibility is unclear. Issuer default, stale NAV or a suspended redemption can impair capital."],
  [["Staking Pool", "Restaking", "Collateral Markets", "Anchor BTC", "Decentralized BTC"],
    "Identify the underlying asset, custody or validator arrangement, mint or deposit terms, and who absorbs slashing or custody losses.",
    "Preview the receipt and rate. Verify limits and whether a receipt can be transferred or sold at a discount.",
    "Compare native redeem or unbond-and-claim with any supported secondary exit. Check delays, liquidity and gas for each transaction.",
    "Stop if exit relies on an unavailable signer or delayed capital you need. Model a slashing, custody or receipt discount loss."],
  [["Stablecoin Wrapper", "Dual-Token Stablecoin"],
    "Identify collateral, mint and redemption assets, backing mechanism and who can pause or restrict redemption.",
    "Preview mint or wrap. Record the resulting units, fees and which asset absorbs losses during a depeg.",
    "Preview redeem or unwrap into the reserve asset and separately check depth if it needs conversion.",
    "Stop if redemption is gated or reserves are unclear. Stress a depeg plus a discounted secondary exit."],
  [["Prediction Market"],
    "Read the dated market rules, named resolution source, dispute period and restrictions.",
    "Simulate an order at your size against both sides of the book. Record possible partial fills and fees.",
    "Compare a sell before resolution with settlement and redemption after it. Check depth for your full position.",
    "Stop if resolution is ambiguous or there is no exit depth. A losing outcome can consume the entire stake."],
  [["Cross Chain Bridge"],
    "Match source and destination network IDs and token contracts. Check whether the received asset is native or wrapped.",
    "Preview a transfer without signing. Record minimum received, finality, relay fees and required destination gas.",
    "Check whether you must claim on the destination and how to recover a stuck transfer. Preview the return route independently.",
    "Stop if destination gas or recovery is missing. Relay delays or a wrapped asset depeg can strand value."],
  [["Chain", "Governance Incentives"],
    "Find the official network or governance portal. Verify prerequisites and whether a test environment is documented.",
    "Try a read-only walkthrough of a test transaction or vote. Check voting power, delegation or asset prerequisites.",
    "Check how to undo delegation, close the test position or recover unused funds. Confirm any lock period.",
    "Stop if the only path involves an unexplained transfer, lock or approval."],
  [["Payments", "Crypto Card Issuer", "OTC Marketplace"],
    "Verify counterparty, asset, region and payment or settlement terms. Identify custody before funds move.",
    "Preview a payment or deal without submitting. Record all-in conversion, routing or escrow charges and recipient amount.",
    "Check cancellation, refund asset, redemption fees and dispute window before committing any funds.",
    "Stop if the recipient, settlement finality or refund process is unclear. Failed payments can still incur charges."],
  [["Insurance"],
    "Match the covered event, insured contracts, underwriting capital and policy exclusions.",
    "Preview premium, deductible, claim limit and coverage start without purchasing.",
    "Check claim deadline, evidence required and who adjudicates. Verify cancellation and refund rules separately.",
    "Stop if the loss you need covered could be excluded. Model a denied claim plus the premium already paid."],
  [["Indexes"],
    "List constituents, weights, rebalancing rules and how assets are held.",
    "Preview buying or minting the units. Compare the execution price with the basket value after fees.",
    "Preview redeeming into constituents or selling the units. Check liquidity and the cost of converting the basket.",
    "Stop if the redemption asset is unclear or depth is inadequate. Stress the largest constituent and the fund's price discount."],
];

export function buildFarmPlan(protocol: Protocol): { farm_sources: [string, string][]; farm_steps: string[] } {
  const documented = documentedPlans.get(protocol.slug);
  const category = categoryPlans.find(([categories]) => categories.includes(protocol.category ?? ""));
  const actions = documented?.actions ?? category?.slice(1) ?? [
    "Find a documented user action, supported network and asset. Keep the plan read-only if these cannot be established.",
    "Preview the action and write down every approval, asset movement, receipt and fee.",
    "Locate the inverse action and check liquidity, restrictions and who can stop it.",
    "Stop if a full exit cannot be rehearsed. Check whether lost access or a failing counterparty can consume capital.",
  ];
  const sourceCheck = documented
    ? "Use the linked official workflow docs. Separately verify the deployment and current conditions."
    : "Find the project-owned docs and cross-check the domain, network and contract before proceeding.";
  return {
    farm_sources: documented?.sources ?? [],
    farm_steps: [
      `Identify route · 5–10 min review. ${sourceCheck} ${actions[0]}`,
      `Rehearse entry · 10–15 min review. ${actions[1]} Live entry gas, fees and minimums are unknown.`,
      `Rehearse exit · 10–15 min review. ${actions[2]} Live exit gas, fees and settlement time are unknown.`,
      `Set stop rules · 5–10 min review. ${actions[3]} Enter your own hold time and loss limit. Verify official program terms separately. Eligibility and rewards are unknown.`,
    ],
  };
}
