const documentedPlans = new Map([
  ["steakhouse-financial", {
    sources: [
      ["Steakhouse legacy vaults", "https://www.steakhouse.financial/docs/products/vault-products/legacy-vaults"],
      ["Morpho V1 markets and queues", "https://docs.morpho.org/curate/tutorials-v1/manage-markets/"],
    ],
    actions: [
      "Inspect Steakhouse USDC on Ethereum, listed as a legacy Morpho V1 vault. Match the contract and USDC to the official vault list, then inspect its underlying markets and caps.",
      "If evaluating a deposit, preview USDC in and vault shares out. Record approval and deposit gas separately and check the displayed fee schedule.",
      "Preview redeeming the same shares to USDC. Inspect the Morpho V1 withdrawal queue and compare withdrawable USDC with your full position before entering.",
      "Stop if markets in the withdrawal queue cannot cover the exit. Model a drop in USDC or share value from impaired underlying loans.",
    ],
  }],
  ["veda", {
    sources: [["Veda Teller and BoringQueue", "https://docs.veda.tech/architecture-and-flow-of-funds/core-components"]],
    actions: [
      "Locate a documented BoringVault deployment and verify its Teller, accepted asset and output shares for the selected chain.",
      "Preview assets in and shares out through the Teller. Check the Accountant exchange rate and any restrictions on share transfers.",
      "Check instant withdrawal before relying on it. For a BoringQueue route, preview the request and inspect maturity, solver deadline and cancellation rules for that asset.",
      "Stop if you cannot tolerate waiting for a solver or holding the shares after cancellation. Stress the share value and queue timing.",
    ],
  }],
  ["usdd", {
    sources: [["USDD vault guide", "https://docs.usdd.io/user-guide/getting-started"]],
    actions: [
      "Use the network-specific USDD Vault guide to verify accepted collateral, minimum ratio, liquidation conditions and debt asset.",
      "Preview collateral in and USDD minted without signing. Record stability fees and model collateral depreciation before opening debt.",
      "Preview USDD payback including stability fees, followed by collateral withdrawal. Check both costs and keep a separate repayment path.",
      "Stop if acquiring USDD to repay could force a distressed sale. A drop through the liquidation threshold can consume collateral.",
    ],
  }],
  ["bittensor-dtao", {
    sources: [["Bittensor staking and delegation", "https://guides.learnbittensor.org/staking-and-delegation/delegation"]],
    actions: [
      "Identify the subnet and validator. For non-root Dynamic TAO, confirm stake is held in subnet-specific alpha.",
      "Preview TAO for alpha in the subnet pool. Record the implied rate, transaction fee and any price-protection settings.",
      "Preview exchanging alpha back to TAO by unstaking. Check price impact at the full position size and whether any stake is locked.",
      "Stop if the position cannot be unstaked on your timetable. Stress both the alpha/TAO rate and the USD value of TAO.",
    ],
  }],
  ["polymarket-international", {
    sources: [
      ["Polymarket resolution rules", "https://help.polymarket.com/en/articles/13364518-how-are-prediction-markets-resolved"],
      ["Polymarket limit orders", "https://help.polymarket.com/en/articles/13364444-limit-orders"],
    ],
    actions: [
      "If access is available, inspect one market's resolution rules beneath its order book and confirm the named evidence source.",
      "Simulate a limit order for one outcome and note the possible spend, partial fills, and cost of funding and withdrawal.",
      "Compare selling shares before resolution with holding through settlement. Read dispute rules and inspect bids for the full position.",
      "Stop if access or settlement conditions are unclear. Losing shares can be worth zero at resolution.",
    ],
  }],
]);

module.exports = { documentedPlans };
