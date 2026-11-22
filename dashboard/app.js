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
    J = (e) =>
      new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
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
        ? '<span class="change-none">Loading</span>'
        : `<span class="${e >= 0 ? "change-pos" : "change-neg"}">${e > 0 ? "+" : ""}${e.toFixed(1)}%</span>`;
  ((query("#snapshot-date").textContent = snapshotData.as_of),
    (query("#count-date").textContent = snapshotData.as_of),
    (query("#footer-date").textContent = snapshotData.as_of),
    (query("#count-radar").textContent =
      snapshotData.rows.length.toLocaleString("en-US")),
    (query("#count-watch").textContent =
      snapshotData.watchlist_size.toLocaleString("en-US")),
    (query("#count-live").textContent =
      snapshotData.live.length.toLocaleString("en-US")),
    (query("#source-line").textContent =
      `${snapshotData.protocols.length.toLocaleString("en-US")} records \xB7 ${snapshotData.source}`),
    (query("#tab-radar-count").textContent = snapshotData.rows.length),
    (query("#tab-live-count").textContent = snapshotData.live.length));
  const M = new Set(snapshotData.rows.map((e) => e.slug)),
    F = snapshotData.watchlist.filter((e) => M.has(e)),
    U = snapshotData.watchlist.filter((e) => !M.has(e));
  ((query("#coverage-count").textContent = F.length.toLocaleString("en-US")),
    (query("#coverage-total").textContent =
      snapshotData.watchlist.length.toLocaleString("en-US")),
    (query("#coverage-rule").textContent =
      "Radar requires absent token IDs; generic exclusions apply. WBTC is Bridge; Binance staked ETH is Liquid Staking and marked staked. No parent/dependency map; none inferred."),
    (query("#coverage-source").textContent =
      `Source: ${snapshotData.source} \xB7 ${snapshotData.as_of} \xB7 ${snapshotData.protocols.length} snapshot records.`),
    (query("#coverage-summary").innerHTML =
      `<b>Snapshot watchlist: ${snapshotData.watchlist.length}; ${F.length} in radar.</b> Board: ${snapshotData.rows.length}; ${snapshotData.rows.filter((e) => !snapshotData.watchlist.includes(e.slug)).length} additional discoveries. Coverage is the actual slug intersection.${U.length ? ` Missing official slugs: ${c(U.join(", "))}.` : ""}`));
  const v = snapshotData.validation,
    O = (e) =>
      `n=${e.n} \xB7 median APE ${(e.median_ape * 100).toFixed(1)}% \xB7 within 2\xD7 ${(e.within_2x * 100).toFixed(1)}%`;
  ((query("#validation-evidence").innerHTML =
    `<div class="validation-heading"><div><p class="eyebrow">SNAPSHOT-ONLY CHECKS</p><h2>Listed market-cap reconstruction</h2></div><span>Not launch validation</span></div><p class="validation-context">Same-date listed-cap check · board comparables n=${snapshotData.calibration_peer_count}. Holdout ${v.train_count}/${v.holdout_count}; category median at n ≥ 5, else global.</p><div class="validation-grid"><article><span>Holdout · category / global</span><strong>${O(v.strategy)}</strong><small>MAE ${v.strategy.mae_log10.toFixed(4)}</small></article><article><span>Holdout · global only</span><strong>${O(v.global_peer_median)}</strong><small>MAE ${v.global_peer_median.mae_log10.toFixed(4)}</small></article><article><span>Holdout · TVL only</span><strong>${O(v.tvl_equals_market_cap)}</strong><small>MAE ${v.tvl_equals_market_cap.mae_log10.toFixed(4)}</small></article></div><p class="validation-context">Training-only 5-fold out-of-fold CV n=${v.training_cv.validation_count}: category/global APE ${(v.training_cv.category_global.median_ape * 100).toFixed(2)}%, within 2× ${(v.training_cv.category_global.within_2x * 100).toFixed(2)}%, MAE ${v.training_cv.category_global.mae_log10.toFixed(4)}; global-only ${(v.training_cv.global_peer_median.median_ape * 100).toFixed(2)}%, ${(v.training_cv.global_peer_median.within_2x * 100).toFixed(2)}%, ${v.training_cv.global_peer_median.mae_log10.toFixed(4)}; TVL-only ${(v.training_cv.tvl_equals_market_cap.median_ape * 100).toFixed(2)}%, ${(v.training_cv.tvl_equals_market_cap.within_2x * 100).toFixed(2)}%, ${v.training_cv.tvl_equals_market_cap.mae_log10.toFixed(4)}.</p><p class="validation-limit">Small selected cross-section; no tokenless, launch, or future-return validation.</p>`),
    (query("#method-copy").textContent =
      "Executable estimate = TVL × trimmed category median market-cap/TVL (n ≥ 5, else global) × growth × tracking-tenure proxy. Growth weight 0.25; change clamp −50% to +100%; tenure 0.85–1 over 730 tracked days. Tracking date is not tokenless age. Validation is mixed and favors global-only on holdout."));
  const R = query("#category"),
    D = query("#chain");
  (query("#show-official").addEventListener("click", () => {
    ((query("#scope").value = "watch"),
      (query("#search").value = ""),
      (query("#category").value = ""),
      (query("#chain").value = ""),
      (b = "radar"),
      queryAll(".view-tab").forEach((e) => {
        const n = e.dataset.view === "radar";
        (e.classList.toggle("active", n),
          e.setAttribute("aria-pressed", String(n)));
      }),
      renderBoard(),
      query("#search").focus());
  }),
    [...new Set(snapshotData.rows.map((e) => e.category).filter(Boolean))]
      .sort()
      .forEach((e) => R.add(new Option(e, e))),
    [...new Set(snapshotData.rows.flatMap((e) => e.chains))]
      .sort()
      .forEach((e) => D.add(new Option(e, e))));
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
    ((query("#watch-count").textContent =
      `${g.size.toLocaleString("en-US")} saved \xB7 ${snapshotData.rows.filter((e) => g.has(e.slug)).length.toLocaleString("en-US")} in radar`),
      (query("#watch-storage-note").textContent =
        x === "available"
          ? "Saved on this device"
          : "Session only \xB7 browser storage unavailable"));
  }
  ((query("#watch-count").textContent =
    `${g.size.toLocaleString("en-US")} saved \xB7 ${snapshotData.rows.filter((e) => g.has(e.slug)).length.toLocaleString("en-US")} in radar`),
    (query("#watch-storage-note").textContent =
      x === "available"
        ? "Saved on this device"
        : "Session only \xB7 browser storage unavailable"));
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
          (d === "watch"
            ? N.has(p.slug)
            : p.tvl_usd < snapshotData.floor_usd)) &&
        (b === "live" || !A || g.has(p.slug))
      );
    });
    (_.sort((p, u) => {
      const r = p[S] ?? -1 / 0,
        a = u[S] ?? -1 / 0;
      return (typeof r == "string" ? r.localeCompare(a) : r - a) * (k ? -1 : 1);
    }),
      (C = _),
      renderRows());
  }
  function renderRows() {
    (renderScenario(),
      (query("#board-title").textContent =
        b === "radar" ? "The radar board" : "Token-recorded protocols"),
      (query("#results-label").textContent =
        `Showing ${C.length.toLocaleString("en-US")} of ${(b === "radar" ? snapshotData.rows : snapshotData.live).length.toLocaleString("en-US")} protocols`),
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
            (n.key === "Enter" || n.key === " ") &&
              (n.preventDefault(), openRecordDetails(e.dataset.slug));
          }));
      }),
      queryAll("#rows [data-watch]").forEach((e) =>
        e.addEventListener("click", (n) => {
          n.stopPropagation();
          const i = e.dataset.watch;
          (g.has(i) ? g.delete(i) : g.add(i), saveWatchlist(), renderBoard());
        }),
      ));
  }
  function renderScenario() {
    const record = C[0];
    const budget = Number(query("#scenario-budget").value);
    const gasText = query("#scenario-gas").value;
    const feesText = query("#scenario-fees").value;
    const gas = gasText === "" ? null : Number(gasText);
    const fees = feesText === "" ? null : Number(feesText);
    const action = query("#scenario-action");

    if (b === "live") {
      action.textContent =
        "Radar planning applies only to records with token fields absent.";
      return;
    }
    if (!record) {
      action.textContent =
        "No radar records match. Change the filters to see a conditional plan.";
      return;
    }

    const knownCosts = [gas, fees].filter((value) => value !== null);
    const knownCostTotal = knownCosts.reduce(
      (total, value) => total + value,
      0,
    );
    const allCostsKnown = gas !== null && fees !== null;
    const totalOutlay = allCostsKnown ? budget + knownCostTotal : null;
    const money = (value) => `$${value.toFixed(2)}`;
    const costLine = allCostsKnown
      ? `Illustrative total outlay: ${money(budget)} capital + ${money(gas)} gas + ${money(fees)} protocol fees = ${money(totalOutlay)}.`
      : `Known subtotal: ${money(budget)} capital${gas === null ? " + gas unknown" : ` + ${money(gas)} gas`}${fees === null ? " + protocol fees unknown" : ` + ${money(fees)} protocol fees`}. Total outlay cannot be estimated until both cost inputs are supplied.`;
    action.innerHTML = `<div class="scenario-current"><b>${c(record.name)} · ${c(record.category || "Unclassified")}</b><br><span>${c(record.farm_steps[1])}</span><div class="scenario-math"><b>Hypothetical inputs</b><span>Capital cap: ${money(budget)}</span><span>Network gas: ${gas === null ? "unknown" : money(gas)}${gas === null ? " (enter a user-supplied quote)" : " (user supplied, not app-verified)"}</span><span>Protocol fees: ${fees === null ? "unknown" : money(fees)}${fees === null ? " (enter user-supplied terms)" : " (user supplied, not app-verified)"}</span><span>${costLine}</span><span>Capital loss exposure: $0 to ${money(budget)}, plus unknown costs. No reward estimate or eligibility assumed.</span></div><span class="scenario-time">Planning time estimate: 15 to 25 minutes. Any action stays conditional on verifying the official route, asset, approvals, exit path, and final quoted costs.</span></div>`;
  }
  function openRecordDetails(e) {
    const n = H.get(e);
    if (!n) return;
    const i = Y.get(e),
      d = !!i,
      f = !(n.gecko_id === null && n.symbol === null),
      _ = n.tvl_usd < snapshotData.floor_usd,
      p =
        i?.age_days ??
        (n.listed_at
          ? Math.max(
              0,
              Math.floor(
                (Date.parse(`${snapshotData.as_of}T00:00:00Z`) -
                  Date.parse(`${n.listed_at}T00:00:00Z`)) /
                  864e5,
              ),
            )
          : null),
      u = (i?.farm_steps || []).map((s) => `<li>${c(s)}</li>`).join(""),
      r = i?.valuation_inputs,
      a =
        r && typeof window.calculateRadarValue == "function"
          ? window.calculateRadarValue(r)
          : null,
      l = a === i?.implied_value_usd,
      $ = r
        ? `<div class="model-trace" aria-label="Executable per-record valuation inputs"><div><b>Executable formula</b> max(1, Math.round(TVL \xD7 peer ratio \xD7 growth \xD7 tenure))</div><div><b>Calibration</b> ${c(r.calibration_scope)} \xB7 ratio ${r.calibration_ratio.toPrecision(6)} \xB7 n=${r.calibration_peer_count}</div><div><b>TVL input</b> ${m(r.tvl_usd)}</div><div><b>7D change input</b> ${r.change_7d === null ? "Missing \u2192 neutral growth 1.0000" : `${r.change_7d}% \u2192 bounded ${r.bounded_change_7d}% \u2192 growth ${r.growth_multiplier.toFixed(6)}`}</div><div><b>Listing date</b> ${r.listing_date === null ? "Missing \u2192 neutral tenure 1.0000" : `${c(r.listing_date)} \u2192 ${r.tracked_age_days} tracked days \u2192 tenure ${r.tenure_multiplier.toFixed(6)}`}</div><div><b>Tenure meaning</b> Snapshot tracking age only; not tokenless age.</div><div><b>Rounding</b> ${c(r.rounding)}</div><div class="${l ? "model-match" : "model-mismatch"}"><b>Recomputed / emitted</b> ${m(a)} / ${m(i.implied_value_usd)} \xB7 ${l ? "MATCH" : "DIVERGENCE"}</div></div>`
        : "",
      L = Number(query("#scenario-budget").value);
    ((query("#detail-content").innerHTML =
      `<div class="detail-kicker">${d ? "RADAR RECORD \xB7 " + (N.has(n.slug) ? "WATCHLIST COVERED" : _ ? "BELOW WATCHLIST FLOOR" : "EXTENDED DISCOVERY") : f ? "TOKEN FIELDS RECORDED \xB7 MARKET DATA VIEW" : "SNAPSHOT RECORD \xB7 NOT IN RADAR FILTERS"}</div><h2 class="detail-title" id="detail-title">${c(n.name)}</h2><p class="detail-lede">${c(n.category || "Category not reported")} \xB7 ${c(n.chains.join(", ") || "Chain data not reported")} \xB7 snapshot slug <code>${c(n.slug)}</code></p><button class="detail-watch ${g.has(n.slug) ? "is-watched" : ""}" type="button" data-detail-watch="${c(n.slug)}" aria-pressed="${g.has(n.slug)}">${g.has(n.slug) ? "\u2605 Saved to my watchlist" : "\u2606 Add to my watchlist"}</button><div class="detail-metrics"><div><span>${d ? "RADAR RANK" : f ? "MARKET CAP" : "TOKEN FIELDS"}</span><strong>${d ? "#" + i.rank : f ? m(n.mcap_usd) : "Not recorded"}</strong></div><div><span>TVL</span><strong>${m(n.tvl_usd)}</strong></div><div><span>7D TVL CHANGE</span><strong>${n.change_7d == null ? "Not reported" : (n.change_7d > 0 ? "+" : "") + n.change_7d.toFixed(2) + "%"}</strong></div><div><span>TRACKED AGE</span><strong>${p == null ? "Unknown" : p.toLocaleString() + " days"}</strong></div></div>${d ? `<h3 class="detail-section-title">VALUE TRACE \xB7 MODEL ESTIMATE</h3><div class="value-explainer"><code>${c(i.valuation_note)}</code><br>Implied value: <b>${m(i.implied_value_usd)}</b>. Comparable sample and coefficients are disclosed assumptions. Not a price target or issuance probability.${$}</div><h3 class="detail-section-title">CATEGORY RESEARCH PLAN \xB7 NOT VERIFIED</h3><p class="farm-provenance">Source: ${c(snapshotData.source)} \xB7 ${c(snapshotData.as_of)}. Snapshot evidence is limited to record fields above. These are conditional category steps; project documentation and routes have not been checked.</p><p class="farm-budget-note"><b>Hypothetical capital cap: $${L}.</b> Gas: unknown. Protocol fees: unknown. Total outlay is not estimated. Potential capital loss: $0 to $${L}, plus unknown costs. Any dollar costs shown in the board are user-supplied and have not been verified by this app.</p><ol class="farm-list">${u}</ol><p class="detail-warning">Absent fields do not prove no token. No live program, eligibility, fees, safety, or rewards established; verify first. Gas and capital at risk are unknown.</p>` : f ? '<h3 class="detail-section-title">SEPARATE MARKET DATA RECORD</h3><div class="value-explainer">Token fields are recorded in this snapshot, so this protocol is excluded from the radar valuation. Market cap and TVL are the snapshot record, not a valuation estimate from this interface.</div>' : '<h3 class="detail-section-title">OUTSIDE THE RADAR FILTER</h3><div class="value-explainer">This full-snapshot record is not in the token-absent radar subset. Its available snapshot fields are shown above; token-field absence is not inferred.</div>'}`),
      query("#detail-content [data-detail-watch]").addEventListener(
        "click",
        (s) => {
          const h = s.currentTarget.dataset.detailWatch;
          (g.has(h) ? g.delete(h) : g.add(h),
            saveWatchlist(),
            openRecordDetails(h),
            renderBoard());
        },
      ),
      query("#detail").showModal());
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
          (S === "implied_value_usd" || S === "mcap_usd") &&
            (S = n.dataset.sort),
          updateSortLabels(),
          (query("#scope").disabled = b === "live"),
          renderBoard());
      }),
    ),
    query("#search").addEventListener("input", renderBoard),
    R.addEventListener("change", renderBoard),
    D.addEventListener("change", renderBoard),
    query("#scope").addEventListener("change", renderBoard),
    (() => {
      for (const input of [
        "#scenario-budget",
        "#scenario-gas",
        "#scenario-fees",
      ]) {
        query(input).addEventListener("input", () => {
          renderScenario();
          if (query("#detail").open) {
            const slug = query("#detail-content [data-detail-watch]")?.dataset
              .detailWatch;
            if (slug) openRecordDetails(slug);
          }
        });
      }
    })(),
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
        e.key === "Escape" &&
          query("#detail").open &&
          query("#detail").close());
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
  const q = snapshotData.protocols || [
      ...snapshotData.rows,
      ...snapshotData.live,
    ],
    B = queryAll(".section-tab");
  function renderSection(e) {
    B.forEach((a) => {
      (a.classList.toggle("active", a.dataset.section === e),
        a.dataset.section === e
          ? a.setAttribute("aria-current", "page")
          : a.removeAttribute("aria-current"));
    });
    const n = e === "board";
    if (
      ((query("#board").hidden = !n),
      (query(".view-tabs").hidden = !n),
      (query("#insights").hidden = n),
      n)
    )
      return;
    const i = query("#insights"),
      d = i.contains(document.activeElement) ? document.activeElement.id : "",
      f =
        d && typeof document.activeElement.selectionStart == "number"
          ? document.activeElement.selectionStart
          : null,
      _ = [...new Set(q.map((a) => a.category).filter(Boolean))].sort(),
      p = () => {
        if (d) {
          const a = query("#" + d);
          a && (a.focus(), f !== null && a.setSelectionRange(f, f));
        }
      },
      u = c,
      r = `Snapshot: ${u(snapshotData.as_of)} \xB7 Frozen cross-section \xB7 TVL is protocol TVL, not DEX pair liquidity.`;
    if (e === "liquidity") {
      const a = (query("#liq-search")?.value || "").trim().toLowerCase(),
        l = query("#liq-category")?.value || "",
        $ = query("#liq-sort")?.value || "tvl",
        L = q
          .filter(
            (s) =>
              (!a ||
                `${s.name} ${s.slug} ${s.category || ""} ${s.chains.join(" ")}`
                  .toLowerCase()
                  .includes(a)) &&
              (!l || s.category === l),
          )
          .sort((s, h) =>
            $ === "change"
              ? (h.change_7d ?? -1 / 0) - (s.change_7d ?? -1 / 0) ||
                s.slug.localeCompare(h.slug)
              : $ === "name"
                ? s.name.localeCompare(h.name) || s.slug.localeCompare(h.slug)
                : h.tvl_usd - s.tvl_usd || s.slug.localeCompare(h.slug),
          );
      ((i.innerHTML = `<div class="section-heading"><div><p class="eyebrow">SNAPSHOT RANKINGS</p><h2>Protocol TVL</h2><p class="section-deck">TVL may overlap; not chain or DEX liquidity or executable depth.</p></div><span class="section-date">${r}</span></div><div class="section-tools"><label>Search snapshot records <input id="liq-search" type="search" placeholder="Name, category or chain" value="${u(a)}"></label><label>Category <select id="liq-category"><option value="">All categories</option>${_.map((s) => `<option ${s === l ? "selected" : ""}>${u(s)}</option>`).join("")}</select></label><label>Sort by <select id="liq-sort"><option value="tvl" ${$ === "tvl" ? "selected" : ""}>TVL, high to low</option><option value="change" ${$ === "change" ? "selected" : ""}>7-day change, high to low</option><option value="name" ${$ === "name" ? "selected" : ""}>Name, A to Z</option></select></label></div><p class="section-note">${L.length} rows · USD · 7-day TVL change, not token price.</p><div class="rank-list">${L.length ? L.map((s, h) => `<button class="rank-row record-button" type="button" data-open="${u(s.slug)}"><span class="rank-number">${String(h + 1).padStart(3, "0")}</span><span class="rank-name"><strong>${u(s.name)}</strong><small>${u(s.category || "Unclassified")} \xB7 ${u(s.chains.slice(0, 3).join(", ") || "Chain not reported")}</small></span><strong class="rank-tvl">${m(s.tvl_usd)}</strong><span class="rank-change">${s.change_7d == null ? "Not reported" : formatPercent(s.change_7d)}</span></button>`).join("") : '<p class="section-empty">No snapshot records match. Try another search or category.</p>'}</div>`),
        i
          .querySelectorAll("[data-open]")
          .forEach((s) =>
            s.addEventListener("click", () =>
              openRecordDetails(s.dataset.open),
            ),
          ),
        query("#liq-search").addEventListener("input", () => renderSection(e)),
        query("#liq-category").addEventListener("change", () =>
          renderSection(e),
        ),
        query("#liq-sort").addEventListener("change", () => renderSection(e)),
        p());
    } else if (e === "launch") {
      const a = (query("#launch-search")?.value || "").trim().toLowerCase(),
        l = query("#launch-category")?.value || "",
        $ = query("#launch-sort")?.value || "value",
        L = snapshotData.rows
          .filter(
            (s) =>
              (!a ||
                `${s.name} ${s.slug} ${s.category || ""} ${s.chains.join(" ")}`
                  .toLowerCase()
                  .includes(a)) &&
              (!l || s.category === l),
          )
          .sort((s, h) =>
            $ === "tvl"
              ? h.tvl_usd - s.tvl_usd || s.slug.localeCompare(h.slug)
              : $ === "change"
                ? (h.change_7d ?? -1 / 0) - (s.change_7d ?? -1 / 0) ||
                  s.slug.localeCompare(h.slug)
                : $ === "name"
                  ? s.name.localeCompare(h.name) || s.slug.localeCompare(h.slug)
                  : h.implied_value_usd - s.implied_value_usd ||
                    s.slug.localeCompare(h.slug),
          );
      ((i.innerHTML = `<div class="section-heading"><div><p class="eyebrow">TOKEN FIELDS NOT RECORDED</p><h2>Launch research candidates</h2><p class="section-deck">Records with absent token fields, not upcoming launches, verified airdrops, or proof a token will exist.</p></div><span class="section-date">${r}</span></div><div class="section-tools"><label>Search candidates <input id="launch-search" type="search" placeholder="Name, category or chain" value="${u(a)}"></label><label>Category <select id="launch-category"><option value="">All categories</option>${_.map((s) => `<option ${s === l ? "selected" : ""}>${u(s)}</option>`).join("")}</select></label><label>Sort by <select id="launch-sort"><option value="value" ${$ === "value" ? "selected" : ""}>Model value, high to low</option><option value="tvl" ${$ === "tvl" ? "selected" : ""}>TVL, high to low</option><option value="change" ${$ === "change" ? "selected" : ""}>7-day change, high to low</option><option value="name" ${$ === "name" ? "selected" : ""}>Name, A to Z</option></select></label></div><p class="section-note">All ${L.length} rows \xB7 absent symbol/ID does not prove token absence. Select for model trace and research plan.</p><div class="opportunity-grid">${L.length ? L.map((s) => `<button type="button" class="opportunity-card record-button" data-open="${u(s.slug)}"><span>${N.has(s.slug) ? "WATCHLIST FLOOR" : "DISCOVERY \xB7 SNAPSHOT ONLY"}</span><h3>${u(s.name)}</h3><p>${u(s.category || "Unclassified")} \xB7 ${u(s.chains.slice(0, 2).join(", ") || "Chain not reported")}</p><span class="card-metric"><b>${m(s.tvl_usd)}</b><small>snapshot TVL</small></span><small>Model value ${m(s.implied_value_usd)} \xB7 7D TVL ${s.change_7d == null ? "not reported" : formatPercent(s.change_7d)} \xB7 tracking date ${s.listed_at || "not reported"}</small><span class="opportunity-action"><b>Next research task \xB7 10 to 15 min:</b> ${u(s.farm_steps[1])}</span></button>`).join("") : '<p class="section-empty">No candidates match these filters.</p>'}</div>`),
        i
          .querySelectorAll("[data-open]")
          .forEach((s) =>
            s.addEventListener("click", () =>
              openRecordDetails(s.dataset.open),
            ),
          ),
        query("#launch-search").addEventListener("input", () =>
          renderSection(e),
        ),
        query("#launch-category").addEventListener("change", () =>
          renderSection(e),
        ),
        query("#launch-sort").addEventListener("change", () =>
          renderSection(e),
        ),
        p());
    } else renderCharts(i, q, _, u, r);
  }
  function formatPercent(e) {
    return `${e > 0 ? "+" : ""}${e.toFixed(1)}%`;
  }
  function renderCharts(e, n, i, d, f) {
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
    ((e.innerHTML = `<div class="section-heading"><div><p class="eyebrow">ONE-DATE CROSS-SECTION</p><h2>Snapshot charts</h2><p class="section-deck">One-date cross-section; no time series or price activity.</p></div><span class="section-date">${f}</span></div><div class="chart-grid"><article class="chart-card"><h3>TVL by category</h3><p>Sum of reported protocol TVL \xB7 top 8 categories \xB7 overlapping totals</p><div class="bar-chart" role="group" aria-label="Category TVL sums; records may overlap">${p.map(([a, l]) => `<button class="bar-row" type="button" data-chart-cat="${d(a)}" aria-label="Filter liquidity ranking by ${d(a)}, summed protocol TVL ${m(l)}"><span>${d(a)}</span><i aria-hidden="true"><b style="width:${Math.max(1, (l / u) * 100)}%"></b></i><strong>${m(l)}</strong></button>`).join("")}</div><small>Overlapping protocol TVL totals; not additive chain liquidity. Select a category to filter.</small></article><article class="chart-card"><h3>7-day TVL change distribution</h3><p>Protocol count by reported percentage band</p><div class="distribution">${r.map(([a, l]) => `<div><span>${d(a)}</span><i aria-hidden="true"><b style="width:${n.length ? (l / n.length) * 100 : 0}%"></b></i><strong>${l}</strong></div>`).join("")}</div><small>All ${n.length} records; missing change is separate. Not price performance.</small></article></div><article class="chart-card top-protocols"><h3>Largest protocols by snapshot TVL</h3><p>Top 10 of ${n.length} · USD at ${d(snapshotData.as_of)} · select for details</p><div class="rank-list">${[
      ...n,
    ]
      .sort((a, l) => l.tvl_usd - a.tvl_usd)
      .slice(0, 10)
      .map(
        (a, l) =>
          `<button type="button" class="rank-row record-button" data-open="${d(a.slug)}"><span class="rank-number">${String(l + 1).padStart(2, "0")}</span><span class="rank-name"><strong>${d(a.name)}</strong><small>${d(a.category || "Unclassified")}</small></span><strong class="rank-tvl">${m(a.tvl_usd)}</strong><span class="rank-change">${a.change_7d == null ? "Not reported" : formatPercent(a.change_7d)}</span></button>`,
      )
      .join("")}</div></article>`),
      e.querySelectorAll("[data-chart-cat]").forEach((a) =>
        a.addEventListener("click", () => {
          (renderSection("liquidity"),
            (query("#liq-category").value = a.dataset.chartCat),
            renderSection("liquidity"));
        }),
      ),
      e
        .querySelectorAll("[data-open]")
        .forEach((a) =>
          a.addEventListener("click", () => openRecordDetails(a.dataset.open)),
        ));
  }
  (B.forEach((e) =>
    e.addEventListener("click", () => renderSection(e.dataset.section)),
  ),
    query("#reset").addEventListener("click", resetFilters),
    query("#clear-empty").addEventListener("click", resetFilters));
  const V = new URLSearchParams(location.search);
  (V.has("q") && (query("#search").value = V.get("q")),
    V.has("slug") && openRecordDetails(V.get("slug")),
    renderBoard());
})();
