// The builder and the browser use the same rounding and floor.
function calculateRadarValue(input) {
  const raw =
    input.tvl_usd *
    input.calibration_ratio *
    input.growth_multiplier *
    input.tenure_multiplier;
  return Math.max(1, Math.round(raw));
}

function compareValuation(frozen, globalRatio, scenario) {
  const { tvlChange, useGlobal, useGrowth, useTracking } = scenario;
  if (tvlChange === null) return { error: "Enter a TVL change to compare." };
  if (!Number.isFinite(tvlChange) || tvlChange < -100 || tvlChange > 1000) {
    return { error: "TVL change must be from −100% to +1,000%." };
  }
  const inputs = {
    tvl_usd: frozen.tvl_usd * (1 + tvlChange / 100),
    calibration_ratio: useGlobal ? globalRatio : frozen.calibration_ratio,
    growth_multiplier: useGrowth ? frozen.growth_multiplier : 1,
    tenure_multiplier: useTracking ? frozen.tenure_multiplier : 1,
  };
  const value = calculateRadarValue(inputs);
  return { inputs, value, delta: value - calculateRadarValue(frozen) };
}

function calculateScenario(input) {
  const { amount, days, decline, entryGas, entryFee, exitGas, exitFee, lossLimit, exitDays } = input;
  const costs = [entryGas, entryFee, exitGas, exitFee];
  const invalidMoney = (value) => value !== null &&
    (!Number.isFinite(value) || value < 0 || value > 1e12);
  const invalidDays = (value) => value !== null && (!Number.isSafeInteger(value) || value < 0);
  if ([amount, lossLimit, ...costs].some(invalidMoney)) {
    return { error: "USD inputs must be between $0 and $1 trillion or left blank." };
  }
  if ([days, exitDays].some(invalidDays)) {
    return { error: "Enter a whole, non-negative number of days or leave it blank." };
  }
  if (decline !== null && (!Number.isFinite(decline) || decline < 0 || decline > 100)) {
    return { error: "Asset decline must be from 0% to 100%." };
  }

  const sum = (...values) => values.includes(null) ? null : values.reduce((a, b) => a + b, 0);
  const entry = sum(entryGas, entryFee);
  const exit = sum(exitGas, exitFee);
  const loss = amount === null || decline === null ? null : amount * (decline / 100);
  const roundTripCost = sum(entry, exit);
  const stressedLoss = sum(loss, roundTripCost);
  const withinLoss = stressedLoss !== null && lossLimit !== null
    ? stressedLoss - lossLimit <= Number.EPSILON * Math.max(stressedLoss, lossLimit) * 4 : null;
  return {
    entry, exit, loss, stressedLoss,
    upfront: sum(amount, entry),
    total: sum(amount, roundTripCost),
    exitValue: loss === null || exit === null ? null : amount - loss - exit,
    stranded: amount === null ? null : amount + (entryGas ?? 0) + (entryFee ?? 0),
    uncountedEntryCosts: entry === null,
    breakEven: amount > 0 && roundTripCost !== null ? roundTripCost / amount * 100 : null,
    lossGate: withinLoss,
    timeGate: days === null || exitDays === null ? null : exitDays <= days,
  };
}

if (typeof module !== "undefined") {
  module.exports = { calculateRadarValue, calculateScenario, compareValuation };
}
