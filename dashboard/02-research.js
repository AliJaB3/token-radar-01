const farmFields = [
  ["amount", "Capital, USD"],
  ["days", "Hold period, days", "1"],
  ["decline", "Asset decline, %"],
  ["entryGas", "Entry gas, USD"],
  ["entryFee", "Entry fees, USD"],
  ["exitGas", "Exit gas, USD"],
  ["exitFee", "Exit fees, USD"],
  ["exitDays", "Exit delay, days", "1"],
  ["lossLimit", "Loss limit, USD"],
];

const generalSources = [
  ["Ethereum gas", "https://ethereum.org/developers/docs/gas/"],
  ["Uniswap swaps", "https://docs.uniswap.org/concepts/protocol/swaps"],
];

function mountResearchTools(container, row, snapshot, drafts, escape) {
  const model = row.valuation_inputs;
  const money = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
  const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 });
  const formatMoney = (value) => value === null ? "Unknown" : cents.format(value);
  const link = ([title, url]) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(title)}</a>`;
  const keyDrivers = (inputs) =>
    `TVL ${money.format(inputs.tvl_usd)} × ratio ${inputs.calibration_ratio.toPrecision(5)}
      × growth ${inputs.growth_multiplier.toFixed(4)} × tracking ${inputs.tenure_multiplier.toFixed(4)}`;

  const age = model.tracked_age_days === null
    ? "Tracking date missing → neutral tracking factor 1.0000."
    : `DefiLlama tracking began ${escape(model.listing_date)} · ${model.tracked_age_days} days to snapshot.`;
  const change = model.change_7d === null
    ? "7D TVL change missing → neutral growth 1.0000."
    : `7D TVL change ${model.change_7d}% · bounded input ${model.bounded_change_7d}%.`;
  const baseline = calculateRadarValue(model);
  const holdout = snapshot.validation;

  container.innerHTML = `
    <section aria-labelledby="farm-title">
      <h3 id="farm-title">Conditional farm plan</h3>
      <p>${row.farm_sources.length
        ? "Official docs describe this workflow. Confirm the selected deployment and current conditions independently."
        : "Category rehearsal based on snapshot metadata. Verify a project-owned route before using it."}</p>
      ${row.farm_sources.length ? `<p>${row.farm_sources.map(link).join(" · ")}</p>` : ""}
      <ol class="farm-list">${row.farm_steps.map((step) => `<li>${escape(step)}</li>`).join("")}</ol>
    </section>
    <section aria-labelledby="cost-title">
      <h3 id="cost-title">Hypothetical entry and exit</h3>
      <p id="cost-help">Supply your own USD amounts and timing. Blank means unknown. Zero needs to be entered explicitly. Review times above are for research.</p>
      <form id="cost-form" aria-labelledby="cost-title" aria-describedby="cost-help">
        <div class="worksheet-fields">
          ${farmFields.map(([name, label, step = "any"]) => `<label>${label}
            <input name="${name}" type="number" min="0" step="${step}" placeholder="Unknown">
          </label>`).join("")}
        </div>
        <div class="worksheet-output" id="cost-output" aria-live="polite"></div>
      </form>
      <p class="reference-links">${generalSources.map(link).join(" · ")}. These sources describe Ethereum and Uniswap respectively. Check costs for your actual route.</p>
    </section>
    <section aria-labelledby="model-title">
      <h3 id="model-title">Compare valuation scenarios</h3>
      <p>Two hypothetical variants of the snapshot formula. Outputs are model dollars. They do not predict price, issuance, or returns.</p>
      <div class="model-trace">
        <b>Frozen board value ${money.format(row.implied_value_usd)} · rank ${row.rank}</b>
        <span>${keyDrivers(model)}</span>
        <span>${model.calibration_scope === "category" ? "Category" : "Global"} peer median, n=${model.calibration_peer_count} before trimming.</span>
        <span>${change} ${age}</span>
        <span>Recomputed ${money.format(baseline)} · ${baseline === row.implied_value_usd ? "MATCH" : "DIVERGENCE"}</span>
      </div>
      <div class="compare-grid">
        ${["A", "B"].map((name) => `
          <fieldset class="valuation-variant" data-variant="${name}">
            <legend>Scenario ${name}</legend>
            <label>TVL change, %<input name="tvlChange" type="number" min="-100" max="1000" step="any"></label>
            <label>Peer anchor
              <select name="anchor">
                <option value="frozen">Board (${model.calibration_peer_count} peers)</option>
                <option value="global">Global (${snapshot.calibration_peer_count} peers)</option>
              </select>
            </label>
            <label class="check-field"><input name="growth" type="checkbox"> Carry 7D growth factor</label>
            <label class="check-field"><input name="tracking" type="checkbox"> Carry tracking factor</label>
            <div class="worksheet-output" aria-live="polite"></div>
          </fieldset>`).join("")}
      </div>
      <p class="model-assumptions">Whole USD rounded with a $1 floor. Switch off a factor to use 1. Tracking age is elapsed time since DefiLlama began tracking. Time without a token is unknown.</p>
      <p class="model-assumptions"><b>Held-out check:</b> category/global ${holdout.strategy.mae_log10.toFixed(4)} vs global-only ${holdout.global_peer_median.mae_log10.toFixed(4)} mean absolute log error (lower is better). This checks same-date listed market cap. See Method for both validation splits.</p>
    </section>`;

  const read = (field) => field.validity.badInput ? NaN : field.value === "" ? null : field.valueAsNumber;
  const form = container.querySelector("#cost-form");
  for (const [key] of farmFields) form.elements.namedItem(key).value = drafts.farm[key] ?? "";

  function showFarmResult() {
    const inputs = Object.fromEntries(farmFields.map(([key]) => [key, read(form.elements.namedItem(key))]));
    drafts.farm = inputs;
    const result = calculateScenario(inputs);
    const output = form.querySelector("#cost-output");
    if (result.error) {
      output.textContent = result.error;
      return;
    }
    const pairs = [
      ["Entry gas + fees", result.entry],
      ["Exit gas + fees", result.exit],
      ["Upfront funding", result.upfront],
      ["Capital + round-trip costs", result.total],
      ["Principal loss at entered decline", result.loss],
      ["Total loss if exit executes", result.stressedLoss],
      ["Exit proceeds after exit costs", result.exitValue],
    ];
    const lossGate = result.lossGate === null ? "Pending" : result.lossGate ? "Within entered limit" : "Stop: loss exceeds limit";
    const timeGate = result.timeGate === null ? "Pending" : result.timeGate ? "Within entered hold" : "Stop: exit delay exceeds hold";
    output.innerHTML = `
      <dl>${pairs.map(([label, value]) => `<div><dt>${label}</dt><dd>${formatMoney(value)}</dd></div>`).join("")}</dl>
      <p>Exit unavailable: ${formatMoney(result.stranded)} of capital and entered entry costs exposed${result.uncountedEntryCosts ? ", plus unknown entry costs" : ""}. Failed transactions may add costs.</p>
      <p>Fee break-even uplift: ${result.breakEven === null ? "Unavailable" : result.breakEven.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "%"}. Excludes rewards and any costs outside your inputs.</p>
      <p><b>Loss gate</b> ${lossGate} · <b>Timing gate</b> ${timeGate}. Gates check your inputs only.</p>`;
  }
  form.addEventListener("submit", (event) => event.preventDefault());
  form.addEventListener("input", showFarmResult);
  showFarmResult();

  for (const panel of container.querySelectorAll(".valuation-variant")) {
    const name = panel.dataset.variant;
    const { tvlChange, anchor, growth, tracking } = Object.fromEntries(
      [...panel.querySelectorAll("[name]")].map((field) => [field.name, field]),
    );
    const initial = drafts[name] ?? { tvlChange: name === "A" ? 0 : -25, useGlobal: name === "B", useGrowth: true, useTracking: true };
    tvlChange.value = initial.tvlChange ?? "";
    anchor.value = initial.useGlobal ? "global" : "frozen";
    growth.checked = initial.useGrowth;
    tracking.checked = initial.useTracking;

    function showVariant() {
      const scenario = { tvlChange: read(tvlChange), useGlobal: anchor.value === "global", useGrowth: growth.checked, useTracking: tracking.checked };
      drafts[name] = scenario;
      const result = compareValuation(model, snapshot.calibration_ratio, scenario);
      const output = panel.querySelector(".worksheet-output");
      if (result.error) {
        output.textContent = result.error;
        return;
      }
      const delta = (result.delta > 0 ? "+" : "") + money.format(result.delta);
      output.innerHTML = `<strong>${money.format(result.value)}</strong><br>${delta} vs frozen
        <small>${keyDrivers(result.inputs)}</small>`;
    }
    panel.addEventListener("input", showVariant);
    showVariant();
  }
}
