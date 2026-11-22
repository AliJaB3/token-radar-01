(() => {
 "use strict";
 const snapshotData = window.RADAR_DATA,
  query = (selector) => document.querySelector(selector),
  queryAll = (selector) => [...document.querySelectorAll(selector)];
 if (!snapshotData) {
  query("#results-label").textContent = "Snapshot data did not load.";
  return;
 }
 const m = (e) =>
   e == null
    ? "Not reported"
    : new Intl.NumberFormat("en-US", {
       style: "currency",
       currency: "USD",
       maximumFractionDigits: 0,
       notation: e >= 1e9 ? "compact" : "standard",
      }).format(e),
  c = (e) =>
   String(e ?? "").replace(
    /[&<>"']/g,
    (n) =>
     ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
     })[n],
   ),
  G = (e) =>
   e == null
    ? '<span class="change-none">Not reported</span>'
    : `<span class="${e >= 0 ? "change-pos" : "change-neg"}">${e > 0 ? "+" : ""}${e.toFixed(1)}%</span>`;
 ((query("#snapshot-date").textContent = snapshotData.as_of),
  (query("#count-date").textContent = snapshotData.as_of),
  (query("#count-radar").textContent =
   snapshotData.rows.length.toLocaleString("en-US")),
  (query("#count-live").textContent =
   snapshotData.live.length.toLocaleString("en-US")),
  (query("#source-line").textContent =
   `${snapshotData.protocols.length.toLocaleString("en-US")} records \xB7 ${snapshotData.source}`),
  (query("#tab-radar-count").textContent = snapshotData.rows.length),
  (query("#tab-live-count").textContent = snapshotData.live.length));
 const M = new Set(snapshotData.rows.map((e) => e.slug)),
  F = snapshotData.watchlist.filter((e) => M.has(e)),
  U = snapshotData.watchlist.filter((e) => !M.has(e));
 ((query("#count-watch").textContent = `${F.length}/${snapshotData.watchlist.length}`),
  (query("#coverage-rule").textContent =
   "Official slugs come from snapshot.watchlist. Additional discoveries use recorded fields. WBTC is Bridge; Binance staked ETH is Liquid Staking. No parent/dependency map; none inferred."),
  (query("#coverage-source").textContent =
   snapshotData.source),
  (query("#coverage-summary").textContent =
   `${F.length}/${snapshotData.watchlist.length} official snapshot watchlist slugs in radar. ${M.size - F.length} additional discoveries.${U.length ? ` Missing: ${U.join(", ")}.` : ""}`));
 const validation = snapshotData.validation;
 const describeMetric = ({ n, median_ape, within_2x, mae_log10 }) =>
  `n=${n} · MAE ${mae_log10.toFixed(4)} · median APE ${(median_ape * 100).toFixed(2)}% · within 2× ${(within_2x * 100).toFixed(2)}%`;
 const metricRows = (items) => items.map(([label, metric]) =>
  `<article><span>${label}</span><strong>${describeMetric(metric)}</strong></article>`).join("");
 const cv = validation.training_cv;
 query("#validation-evidence").innerHTML = `
  <h2>Listed market-cap reconstruction</h2>
  <p>Slug split assigned before fitting. ${validation.train_count} training / ${validation.holdout_count} holdout. Lower mean absolute log₁₀ error (MAE) is better.</p>
  <div class="validation-grid">${metricRows([
   ["Holdout · category / global", validation.strategy],
   ["Holdout · global only", validation.global_peer_median],
   ["Holdout · TVL only", validation.tvl_equals_market_cap],
  ])}</div>
  <p>The category/global model underperforms global-only on this holdout.</p>
  <p>Five-fold training-only validation · ${cv.validation_count} out-of-fold predictions.</p>
  <div class="validation-grid">${metricRows([
   ["Training CV · category / global", cv.category_global],
   ["Training CV · global only", cv.global_peer_median],
   ["Training CV · TVL only", cv.tvl_equals_market_cap],
  ])}</div>
  <p>Same-date peer calibration only. Launch outcomes and model adjustments are unvalidated.</p>`;
 query("#method-copy").textContent =
  "TVL × median peer market-cap/TVL × growth × tracking. Use category peers at n ≥ 5, otherwise all peers. Trim the 10th and 90th percentile tails. Growth weight is 0.25 with 7D change bounded at −50% to +100%. Tracking rises from 0.85 to 1 over 730 days since DefiLlama began tracking. Missing change or date uses 1.";
 const R = query("#category"), D = query("#chain");
 query("#show-official").addEventListener("click", () => {
  renderSection("board");
  resetFilters();
  query('.view-tab[data-view="radar"]').click();
  query("#scope").value = "watch";
  renderBoard();
  query("#search").focus({ preventScroll: true });
 });
 [...new Set(snapshotData.rows.map((row) => row.category).filter(Boolean))]
  .sort().forEach((value) => R.add(new Option(value, value)));
 [...new Set(snapshotData.rows.flatMap((row) => row.chains))]
  .sort().forEach((value) => D.add(new Option(value, value)));
 let b = "radar",
  S = "implied_value_usd",
  k = !0,
  C = snapshotData.rows,
  A = !1;
 const Y = new Map(snapshotData.rows.map((e) => [e.slug, e])),
  H = new Map((snapshotData.protocols || []).map((e) => [e.slug, e])),
  N = new Set(snapshotData.watchlist);
 let g = new Set(),
  x = "available";
 try {
  const e = localStorage.getItem("token-radar.watchlist.v1");
  if (e !== null) {
   const n = JSON.parse(e);
   Array.isArray(n) &&
    n.every((i) => typeof i == "string") &&
    (g = new Set(n.filter((i) => H.has(i))));
  }
 } catch {
  x = "memory";
 }
 function saveWatchlist() {
  try {
   (localStorage.setItem("token-radar.watchlist.v1", JSON.stringify([...g])),
    (x = "available"));
  } catch {
   x = "memory";
  }
  updateWatchlistStatus();
 }
 function updateWatchlistStatus() {
  const radarMatches = snapshotData.rows.filter((row) => g.has(row.slug)).length;
  query("#watch-count").textContent = `${g.size} saved · ${radarMatches} in radar`;
  query("#watch-storage-note").textContent = x === "available"
   ? "Saved on this device" : "Session only · browser storage unavailable";
 }
 updateWatchlistStatus();
 function renderBoard() {
  const e = query("#search").value.trim().toLowerCase(),
   n = R.value,
   i = D.value,
   d = query("#scope").value;
  query("#watch-filter").setAttribute(
   "aria-pressed",
   String(b === "radar" && A),
  );
  const f = b === "radar" ? snapshotData.rows : snapshotData.live;
  queryAll("thead th")[5].textContent =
   b === "radar" ? "IMPLIED VALUE" : "MARKET CAP";
  const _ = f.filter((p) => {
   const u =
    `${p.name} ${p.category ?? ""} ${p.chains.join(" ")} ${p.slug}`.toLowerCase();
   return (
    (!e || u.includes(e)) &&
    (!n || p.category === n) &&
    (!i || p.chains.includes(i)) &&
    (b === "live" ||
     d === "all" ||
     (d === "watch" ? N.has(p.slug) : !N.has(p.slug))) &&
    (b === "live" || !A || g.has(p.slug))
   );
  });
  (_.sort((left, right) => compareRows(left, right, S, k)),
   (C = _),
   renderRows());
 }
 function renderRows() {
  query("#rank-label").textContent = b === "radar" ? "RANKED BY IMPLIED VALUE" : "SNAPSHOT MARKET DATA";
  const research = query("#scenario-action");
  research.textContent = b === "live"
   ? "Market data recorded in the snapshot"
   : C.length ? "" : "No matching farm plans";
  if (b === "radar" && C.length) {
   const button = document.createElement("button");
   button.type = "button";
   button.className = "quiet-button";
   button.textContent = `Plan & compare · ${C[0].name}`;
   const slug = C[0].slug;
   button.addEventListener("click", () => openRecordDetails(slug));
   research.append(button);
  }
  (
   (query("#board-title").textContent =
    b === "radar" ? "The radar board" : "Token-recorded protocols"),
   (query("#results-label").textContent = (() => {
    const scope = query("#scope").value;
    if (b === "live") return `Showing ${C.length} of ${snapshotData.live.length} token-recorded protocols`;
    if (scope === "watch") return `Showing ${C.length} of ${F.length} official snapshot watchlist records`;
    if (scope === "early") return `Showing ${C.length} of ${M.size - F.length} additional discoveries`;
    return `Showing ${C.length} of ${M.size} radar records`;
   })()),
   (query("#empty").hidden = C.length > 0),
   (query("#rows").hidden = C.length === 0),
   (query("#rows").innerHTML = C.map((e, n) => {
    const i = e.rank ?? n + 1,
     d = b === "radar";
    return `<tr tabindex="0" data-slug="${c(e.slug)}" aria-label="Open ${c(e.name)} details"><td class="rank-cell">${String(i).padStart(2, "0")}</td><td class="protocol-cell"><span class="protocol-name">${c(e.name)}</span><span class="protocol-sub">${c(e.slug)}</span></td><td class="category-cell">${c(e.category || "Unclassified")}<span class="chain-tag">\xB7 ${c(e.chains.slice(0, 2).join(", ") || "Chain not reported")}</span></td><td class="num">${m(e.tvl_usd)}</td><td class="num">${G(e.change_7d)}</td><td class="num value-cell">${m(d ? e.implied_value_usd : e.mcap_usd)}</td><td><span class="record-pill ${d ? "" : "early-pill"}">${d ? (N.has(e.slug) ? "WATCHLIST" : "DISCOVERY") : "TOKEN DATA"}</span></td><td><button class="watch-row ${g.has(e.slug) ? "is-watched" : ""}" type="button" data-watch="${c(e.slug)}" aria-label="${g.has(e.slug) ? "Remove" : "Add"} ${c(e.name)} ${g.has(e.slug) ? "from" : "to"} my watchlist" aria-pressed="${g.has(e.slug)}">${g.has(e.slug) ? "\u2605" : "\u2606"}</button></td></tr>`;
   }).join("")),
   queryAll("#rows tr").forEach((e) => {
    (e.addEventListener("click", (n) => {
     n.target.closest("[data-watch]") || openRecordDetails(e.dataset.slug);
    }),
     e.addEventListener("keydown", (n) => {
      n.target === e && (n.key === "Enter" || n.key === " ") &&
       (n.preventDefault(), openRecordDetails(e.dataset.slug));
     }));
   }),
   queryAll("#rows [data-watch]").forEach((e) =>
    e.addEventListener("click", (n) => {
     n.stopPropagation();
     const i = e.dataset.watch;
     (g.has(i) ? g.delete(i) : g.add(i), saveWatchlist(), renderBoard());
     queryAll("#rows [data-watch]").find((button) => button.dataset.watch === i)?.focus();
    }),
   ));
 }
 const draftsBySlug = new Map();
 function openRecordDetails(slug) {
  const protocol = H.get(slug);
  if (!protocol) return;
  const row = Y.get(slug);
  const tokenRecorded = protocol.gecko_id !== null || protocol.symbol !== null;
  const date = protocol.listed_at;
  const trackedDays = date === null ? NaN
   : Math.max(0, Math.floor((Date.parse(snapshotData.as_of) - Date.parse(date)) / 864e5));
  const age = Number.isFinite(trackedDays) ? `${trackedDays.toLocaleString()} days` : "Unknown";
  const metrics = [
   row ? ["Radar rank", `#${row.rank}`] : ["Market cap", m(protocol.mcap_usd)],
   ["TVL", m(protocol.tvl_usd)],
   ["7D TVL change", protocol.change_7d === null ? "Not reported" : formatPercent(protocol.change_7d)],
   ["Tracking age", age],
  ];
  const dialog = query("#detail"), content = query("#detail-content");
  const badge = row ? (N.has(slug) ? "Official snapshot watchlist" : "Additional discovery")
   : tokenRecorded ? "Token recorded" : "Outside radar filters";
  content.innerHTML = `
   <div class="detail-kicker">${badge} · ${c(snapshotData.as_of)}</div>
   <h2 class="detail-title" id="detail-title">${c(protocol.name)}</h2>
   <p class="detail-lede">${c(protocol.category || "Category not reported")} · ${c(protocol.chains.join(", ") || "Chains not reported")} · <code>${c(slug)}</code></p>
   <div class="detail-metrics">${metrics.map(([label, value]) => `<div><span>${label}</span><strong>${c(value)}</strong></div>`).join("")}</div>
   ${row ? '<div class="research-tools"></div>'
    : tokenRecorded ? '<h3 class="detail-section-title">Separate market data record</h3><p>Market cap and TVL come from the frozen snapshot. Token-recorded entries sit outside the radar valuation.</p>'
    : '<h3 class="detail-section-title">Outside the radar filter</h3><p>The available frozen snapshot fields are shown above.</p>'}
   <button class="detail-watch" type="button"></button>`;
  const save = content.querySelector(".detail-watch");
  function updateSaveButton() {
   save.setAttribute("aria-pressed", String(g.has(slug)));
   save.textContent = g.has(slug) ? "★ Saved to my watchlist" : "☆ Add to my watchlist";
  }
  updateSaveButton();
  save.addEventListener("click", () => {
   if (g.has(slug)) g.delete(slug);
   else g.add(slug);
   saveWatchlist();
   updateSaveButton();
   renderBoard();
  });
  if (row) {
   if (!draftsBySlug.has(slug)) draftsBySlug.set(slug, { farm: {} });
   mountResearchTools(content.querySelector(".research-tools"), row, snapshotData, draftsBySlug.get(slug), c);
  }
  dialog.showModal();
  dialog.scrollTop = 0;
 }
 (query("#detail .close-detail").addEventListener("click", () =>
  query("#detail").close(),
 ),
  query("#detail").addEventListener("click", (e) => {
   e.target === query("#detail") && query("#detail").close();
  }),
  query("#method-toggle").addEventListener("click", () => {
   const e = query("#method-panel"),
    n = e.hidden;
   ((e.hidden = !n),
    query("#method-toggle").setAttribute("aria-expanded", String(n)));
  }),
  query("#method-open").addEventListener("click", () => {
   ((query("#method-panel").hidden = !1),
    query("#method-toggle").setAttribute("aria-expanded", "true"),
    query("#method-panel").scrollIntoView({
     behavior: "smooth",
     block: "center",
    }));
  }),
  queryAll(".view-tab").forEach((e) =>
   e.addEventListener("click", () => {
    (queryAll(".view-tab").forEach((i) => {
     (i.classList.toggle("active", i === e),
      i.setAttribute("aria-pressed", String(i === e)));
    }),
     (b = e.dataset.view));
    const n = queryAll(".sort-button")[0];
    ((n.dataset.sort = b === "radar" ? "implied_value_usd" : "mcap_usd"),
     (S === "implied_value_usd" || S === "mcap_usd") && (S = n.dataset.sort),
     updateSortLabels(),
     (query("#scope").disabled = b === "live"),
     renderBoard());
   }),
  ),
  query("#search").addEventListener("input", renderBoard),
  R.addEventListener("change", renderBoard),
  D.addEventListener("change", renderBoard),
  query("#scope").addEventListener("change", renderBoard),
  query("#watch-filter").addEventListener("click", () => {
   (b === "live" &&
    queryAll(".view-tab")
     .find((e) => e.dataset.view === "radar")
     .click(),
    (A = !A),
    query("#watch-filter").setAttribute("aria-pressed", String(A)),
    renderBoard());
  }),
  document.addEventListener("keydown", (e) => {
   (e.key === "/" &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !query("#detail").open &&
    !/input|textarea|select/i.test(document.activeElement.tagName) &&
    (e.preventDefault(), query("#search").focus()),
    e.key === "Escape" && query("#detail").open && query("#detail").close());
  }));
 const Z = (e) =>
  e === "implied_value_usd"
   ? "Implied value"
   : e === "mcap_usd"
     ? "Market cap"
     : e === "tvl_usd"
       ? "TVL"
       : "7D change";
 function updateSortLabels() {
  queryAll(".sort-button").forEach((e) => {
   const n = Z(e.dataset.sort),
    i = e.dataset.sort === S && k ? "ascending" : "descending";
   ((e.textContent =
    e.dataset.sort === S ? `${n} ${k ? "\u2193" : "\u2191"}` : n),
    e.setAttribute("aria-label", `Sort by ${n.toLowerCase()} ${i}`));
  });
 }
 queryAll(".sort-button").forEach((e) =>
  e.addEventListener("click", () => {
   (S === e.dataset.sort ? (k = !k) : ((S = e.dataset.sort), (k = !0)),
    updateSortLabels(),
    renderBoard());
  }),
 );
 function resetFilters() {
  ((query("#search").value = ""),
   (R.value = ""),
   (D.value = ""),
   (query("#scope").value = "all"),
   (A = !1),
   query("#watch-filter").setAttribute("aria-pressed", "false"),
   renderBoard());
 }
 const protocols = snapshotData.protocols;
 const sections = queryAll(".section-tab");
 const insights = query("#insights");
 const sectionState = {
  liquidity: { search: "", category: "", sort: "tvl_usd" },
  launch: { search: "", category: "", sort: "implied_value_usd" },
 };
 function compareRows(left, right, field, descending) {
  const a = left[field], b = right[field];
  const tie = left.slug.localeCompare(right.slug, "en");
  if (a == null || b == null) return a === b ? tie : a == null ? 1 : -1;
  const order = typeof a === "string" ? a.localeCompare(b, "en") : a - b;
  return order * (descending ? -1 : 1) || tie;
 }
 function renderSection(section) {
  for (const tab of sections) {
   const active = tab.dataset.section === section;
   tab.classList.toggle("active", active);
   if (active) tab.setAttribute("aria-current", "page");
   else tab.removeAttribute("aria-current");
  }
  const board = section === "board";
  query("#board").hidden = query(".view-tabs").hidden = !board;
  insights.hidden = board;
  if (board) return;
  const date = c(snapshotData.as_of);
  if (section === "charts") {
   renderCharts(insights, protocols, c, date);
   return;
  }

  const launch = section === "launch";
  const state = sectionState[section];
  const prefix = launch ? "launch" : "liq";
  const records = launch ? snapshotData.rows : protocols;
  const options = [...new Set(records.map((row) => row.category).filter(Boolean))].sort();
  const sortFields = [["tvl_usd", "TVL"], ["change_7d", "7-day TVL change"], ["name", "Name"]];
  if (launch) sortFields.unshift(["implied_value_usd", "Implied value"]);
  insights.innerHTML = `
   <div class="section-heading"><div>
    <h2>${launch ? "Launch research candidates" : "Protocol TVL"}</h2>
    <p class="section-deck">${launch ? "Records with absent token fields. Launches and airdrops are unverified." : "TVL sums may overlap. Executable depth and pair liquidity are unreported."}</p>
   </div><span class="section-date">${date} · Frozen snapshot</span></div>
   <div class="section-tools">
    <label>Search <input id="${prefix}-search" type="search" placeholder="Name, category or chain" value="${c(state.search)}"></label>
    <label>Category <select id="${prefix}-category"><option value="">All categories</option>
     ${options.map((value) => `<option>${c(value)}</option>`).join("")}</select></label>
    <label>Sort by <select id="${prefix}-sort">${sortFields.map(([value, title]) => `<option value="${value}">${title}</option>`).join("")}</select></label>
   </div>
   <p class="section-note" aria-live="polite"></p>
   <div class="${launch ? "opportunity-grid" : "rank-list"}" id="section-rows"></div>`;
  for (const key of ["search", "category", "sort"]) {
   const field = query(`#${prefix}-${key}`);
   field.value = state[key];
   field.addEventListener("input", () => {
    state[key] = field.value;
    updateResults();
   });
  }
  function updateResults() {
   const search = state.search.trim().toLowerCase();
   const matches = records.filter((row) => (!state.category || row.category === state.category)
    && `${row.name} ${row.slug} ${row.category ?? ""} ${row.chains.join(" ")}`.toLowerCase().includes(search));
   matches.sort((left, right) => compareRows(left, right, state.sort, state.sort !== "name"));
   insights.querySelector(".section-note").textContent = `${matches.length} of ${records.length} snapshot records`;
   query("#section-rows").innerHTML = matches.length
    ? (launch ? matches.map(launchCard) : matches.map(rankRow)).join("")
    : '<p class="section-empty">No snapshot records match. Try another search or category.</p>';
  }
  updateResults();
 }
 function rankRow(row, index) {
  return `<button class="rank-row record-button" type="button" data-open="${c(row.slug)}">
   <span class="rank-number">${String(index + 1).padStart(3, "0")}</span>
   <span class="rank-name"><strong>${c(row.name)}</strong><small>${c(row.category || "Unclassified")} · ${c(row.chains.slice(0, 3).join(", ") || "Chain not reported")}</small></span>
   <strong class="rank-tvl">${m(row.tvl_usd)}</strong><span class="rank-change">${row.change_7d === null ? "Not reported" : formatPercent(row.change_7d)}</span>
  </button>`;
 }
 function launchCard(row) {
  return `<button class="opportunity-card record-button" type="button" data-open="${c(row.slug)}">
   <span>${N.has(row.slug) ? "Official snapshot watchlist" : "Additional discovery"}</span>
   <h3>${c(row.name)}</h3>
   <p>${c(row.category || "Unclassified")} · ${c(row.chains.slice(0, 2).join(", ") || "Chain not reported")}</p>
   <span class="card-metric"><b>${m(row.tvl_usd)}</b><small>snapshot TVL</small></span>
   <small>Model value ${m(row.implied_value_usd)} · 7D TVL ${row.change_7d === null ? "not reported" : formatPercent(row.change_7d)} · tracking date ${c(row.listed_at || "not reported")}</small>
   <span class="opportunity-action">${c(row.farm_steps[0])}</span>
  </button>`;
 }
 insights.addEventListener("click", (event) => {
  const record = event.target.closest("[data-open]");
  if (record) openRecordDetails(record.dataset.open);
  const category = event.target.closest("[data-chart-cat]");
  if (category) {
   sectionState.liquidity.category = category.dataset.chartCat;
   sectionState.liquidity.search = "";
   renderSection("liquidity");
   query("#liq-category").focus();
  }
 });
 function formatPercent(e) {
  return `${e > 0 ? "+" : ""}${e.toFixed(1)}%`;
 }
 function renderCharts(e, n, d, f) {
  const _ = new Map();
  n.forEach((a) => {
   const l = a.category || "Unclassified";
   _.set(l, (_.get(l) || 0) + a.tvl_usd);
  });
  const p = [..._].sort((a, l) => l[1] - a[1]).slice(0, 8),
   u = Math.max(1, ...p.map((a) => a[1])),
   r = [
    ["\u2264 \u221220%", (a) => a.change_7d != null && a.change_7d <= -20],
    [
     "\u221220 to \u22125%",
     (a) => a.change_7d != null && a.change_7d > -20 && a.change_7d <= -5,
    ],
    [
     "\u22125 to +5%",
     (a) => a.change_7d != null && a.change_7d > -5 && a.change_7d < 5,
    ],
    [
     "+5 to +20%",
     (a) => a.change_7d != null && a.change_7d >= 5 && a.change_7d < 20,
    ],
    ["\u2265 +20%", (a) => a.change_7d != null && a.change_7d >= 20],
    ["Not reported", (a) => a.change_7d == null],
   ].map(([a, l]) => [a, n.filter(l).length]);
  e.innerHTML = `<div class="section-heading"><div><p class="eyebrow">ONE-DATE CROSS-SECTION</p><h2>Snapshot charts</h2><p class="section-deck">Single snapshot of reported TVL.</p></div><span class="section-date">${f}</span></div><div class="chart-grid"><article class="chart-card"><h3>TVL by category</h3><p>Top 8 categories · overlapping protocol TVL</p><div class="bar-chart" role="group" aria-label="Category TVL sums; records may overlap">${p.map(([a, l]) => `<button class="bar-row" type="button" data-chart-cat="${d(a)}" aria-label="Filter liquidity ranking by ${d(a)}, summed protocol TVL ${m(l)}"><span>${d(a)}</span><i aria-hidden="true"><b style="width:${Math.max(1, (l / u) * 100)}%"></b></i><strong>${m(l)}</strong></button>`).join("")}</div><small>Select a category to filter liquidity.</small></article><article class="chart-card"><h3>7-day TVL change distribution</h3><p>Protocol count by reported percentage band</p><div class="distribution">${r.map(([a, l]) => `<div><span>${d(a)}</span><i aria-hidden="true"><b style="width:${n.length ? (l / n.length) * 100 : 0}%"></b></i><strong>${l}</strong></div>`).join("")}</div><small>All ${n.length} records · TVL change only.</small></article></div><article class="chart-card top-protocols"><h3>Largest protocols by snapshot TVL</h3><p>Top 10 of ${n.length} · USD at ${d(snapshotData.as_of)} · select for details</p><div class="rank-list">${[...n].sort((a, b) => b.tvl_usd - a.tvl_usd).slice(0, 10).map(rankRow).join("")}</div></article>`;
 }
 (sections.forEach((tab) =>
  tab.addEventListener("click", () => renderSection(tab.dataset.section)),
 ),
  query("#reset").addEventListener("click", resetFilters),
  query("#clear-empty").addEventListener("click", resetFilters));
 const V = new URLSearchParams(location.search);
 (V.has("q") && (query("#search").value = V.get("q")),
  V.has("slug") && openRecordDetails(V.get("slug")),
  renderBoard());
})();
