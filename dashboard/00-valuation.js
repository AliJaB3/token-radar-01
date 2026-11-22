// Shared executable valuation used by the offline builder and browser trace.
// This is included in the dashboard dossier so the displayed calculation is auditable.
(function (root) {
  'use strict';
  function calculateRadarValue(input) {
    const raw = input.tvl_usd * input.calibration_ratio * input.growth_multiplier * input.tenure_multiplier;
    return Math.max(1, Math.round(raw));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { calculateRadarValue };
  root.calculateRadarValue = calculateRadarValue;
})(typeof window !== 'undefined' ? window : globalThis);
