// Shared executable valuation used by the offline builder and browser trace.
// This is included in the dashboard dossier so the displayed calculation is auditable.
(function (root) {
  "use strict";
  function calculateRadarValue(input) {
    const raw =
      input.tvl_usd *
      input.calibration_ratio *
      input.growth_multiplier *
      input.tenure_multiplier;
    return Math.max(1, Math.round(raw));
  }
  function calculateScenario(input) {
    const amount = input.amount, days = input.days, decline = input.decline;
    const costs = [input.entryGas, input.entryFee, input.exitGas, input.exitFee];
    if (!Number.isFinite(amount) || amount < 0) return { error: "Enter a non-negative capital amount." };
    if (days !== null && (!Number.isFinite(days) || days < 0)) return { error: "Enter a non-negative holding duration." };
    if (!Number.isFinite(decline) || decline < 0 || decline > 100) return { error: "Decline sensitivity must be from 0% to 100%." };
    if (costs.some(v => v !== null && (!Number.isFinite(v) || v < 0))) return { error: "Costs must be non-negative numbers or left unknown." };
    const known = costs.filter(v => v !== null).reduce((a, v) => a + v, 0);
    return { amount, days, decline, loss: amount * decline / 100, knownCosts: known,
      total: costs.every(v => v !== null) ? amount + known : null,
      exitUnavailableLoss: amount + (input.entryGas ?? 0) + (input.entryFee ?? 0),
      failureCostUnknown: true };
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = { calculateRadarValue, calculateScenario };
  root.calculateRadarValue = calculateRadarValue;
  root.calculateScenario = calculateScenario;
})(typeof window !== "undefined" ? window : globalThis);
