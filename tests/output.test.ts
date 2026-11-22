import { test } from "node:test";
import { snapshotPath } from "./snapshot.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createContext, runInContext } from "node:vm";
import { buildDossier } from "../vendor/makefun-board.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const first = resolve(root, "tests/.output-a"),
  second = resolve(root, "tests/.output-b");
function run(out: string, preview: boolean) {
  return spawnSync(
    process.execPath,
    [
      "main.ts",
      "--input",
      snapshotPath,
      "--output",
      out,
      ...(preview ? ["--preview"] : []),
    ],
    { cwd: root, encoding: "utf8" },
  );
}
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(join(dir, e.name)).map((p) => `${e.name}/${p}`)
        : [e.name],
    )
    .sort();
}

test("preview outputs are deterministic and carry full matching snapshot data", () => {
  try {
    assert.equal(run(first, true).status, 0);
    assert.equal(run(second, true).status, 0);
    assert.deepEqual(files(first), files(second));
    for (const f of files(first))
      assert.deepEqual(
        readFileSync(join(first, f)),
        readFileSync(join(second, f)),
        f,
      );
    const board = JSON.parse(readFileSync(join(first, "board.json"), "utf8"));
    const script = readFileSync(join(first, "data.js"), "utf8");
    const data = JSON.parse(
      script.slice("window.RADAR_DATA=".length).trim().replace(/;$/, ""),
    );
    assert.deepEqual(data.rows, board.rows);
    const sealed = JSON.parse(readFileSync(snapshotPath, "utf8"));
    assert.deepEqual(data.watchlist, sealed.watchlist);
    assert.deepEqual(data.protocols, sealed.protocols);
    assert.equal(data.watchlist.length, 40);
    assert.equal(data.rows.length, 198);
    const tokenRecorded = sealed.protocols.filter((row: { gecko_id: string | null; symbol: string | null }) =>
      row.gecko_id !== null || row.symbol !== null);
    assert.deepEqual([...data.live].sort((a, b) => a.slug.localeCompare(b.slug)),
      tokenRecorded.sort((a, b) => a.slug.localeCompare(b.slug)));
    const intersection = data.watchlist.filter((slug: string) =>
      data.rows.some((r: { slug: string }) => r.slug === slug),
    );
    assert.equal(
      intersection.length,
      40,
      "coverage numerator is the actual watchlist/board slug intersection",
    );
    assert.ok(
      data.watchlist.every((slug: string) => intersection.includes(slug)),
    );
    assert.deepEqual(data.validation, board.validation);
    assert.equal(data.validation.training_cv.validation_count, 94);
    assert.equal(
      data.validation.train_count + data.validation.holdout_count,
      128,
    );
    assert.equal(data.validation.strategy.n, data.validation.holdout_count);
    assert.ok(
      data.validation.holdout_slugs.every(
        (slug: string) => !data.validation.train_slugs.includes(slug),
      ),
    );
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(second, { recursive: true, force: true });
  }
});

test("dashboard files respect source and offline constraints", () => {
  const paths = files(resolve(root, "dashboard"));
  assert.ok(paths.includes("index.html"));
  assert.ok(paths.some((p) => p.endsWith(".js")));
  assert.ok(paths.some((p) => p.endsWith(".css")));
  assert.ok(
    paths.every((p) =>
      p.split("/").every((s) => /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(s)),
    ),
  );
  const sourceBytes = paths.reduce(
    (total, path) => total + statSync(resolve(root, "dashboard", path)).size,
    0,
  );
  assert.ok(sourceBytes < 64000, `dashboard source is ${sourceBytes} bytes`);
  for (const p of paths) {
    const body = readFileSync(resolve(root, "dashboard", p), "utf8");
    if (p.endsWith(".html") || p.endsWith(".css")) {
      assert.doesNotMatch(body, /https?:\/\//, p);
    }
    if (p.endsWith(".js")) {
      assert.doesNotMatch(body, /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']https?:\/\//, p);
      assert.doesNotMatch(body, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/, p);
    }
  }
});

test("emitted source executes in browser scope and recomputes every frozen value", () => {
  try {
    const runResult = run(first, true);
    assert.equal(runResult.status, 0, runResult.stderr);
    const browser = createContext({ window: {} });
    runInContext(readFileSync(join(first, "data.js"), "utf8"), browser);
    const html = readFileSync(join(first, "dashboard/index.html"), "utf8");
    const scripts = Array.from(html.matchAll(/<script src="([^"]+)"/g), match => match[1]!);
    assert.ok(scripts.includes("00-valuation.js") && scripts.includes("02-research.js"));
    for (const path of scripts) assert.ok(existsSync(resolve(first, "dashboard", path)));
    runInContext(readFileSync(join(first, "dashboard/00-valuation.js"), "utf8"), browser);
    assert.equal(runInContext(
      "window.RADAR_DATA.rows.every(row => calculateRadarValue(row.valuation_inputs) === row.implied_value_usd)",
      browser,
    ), true);
    assert.equal(runInContext(`
      window.RADAR_DATA.rows.every(row =>
        compareValuation(row.valuation_inputs, window.RADAR_DATA.calibration_ratio,
          { tvlChange: 0, useGlobal: false, useGrowth: true, useTracking: true }).delta === 0
      )
    `, browser), true);
    runInContext(readFileSync(join(first, "dashboard/02-research.js"), "utf8"), browser);
    assert.deepEqual(JSON.parse(runInContext("JSON.stringify(generalSources.map(([, url]) => url))", browser)), [
      "https://ethereum.org/developers/docs/gas/",
      "https://docs.uniswap.org/concepts/protocol/swaps",
    ]);
  } finally {
    rmSync(first, { recursive: true, force: true });
  }
});

test("the vendor is the exact required kit library", () => {
  assert.equal(
    createHash("sha256")
      .update(readFileSync(resolve(root, "vendor/makefun-board.ts")))
      .digest("hex"),
    "9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e",
  );
});

test("a normal build requires real screenshots and matches the canonical dossier", () => {
  const shots = files(resolve(root, "screenshots"));
  if (shots.length >= 3) {
    try {
      const r = run(first, false);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(files(join(first, "screenshots")).length, 3);
      const expected = buildDossier(first, {
        text_max_bytes: 65536,
        screenshots: { max: 4, max_bytes: 524288 },
        dashboard: { max_files: 400, max_bytes: 4194304 },
      });
      assert.deepEqual(
        readFileSync(join(first, "dossier.json")),
        Buffer.from(expected),
      );
      const dossier = JSON.parse(
        readFileSync(join(first, "dossier.json"), "utf8"),
      );
      for (const path of files(join(first, "dashboard"))) {
        const source = readFileSync(join(first, "dashboard", path), "utf8");
        assert.ok(dossier.text.includes(source), `dossier contains the full source of ${path}`);
      }
      assert.ok(Buffer.byteLength(dossier.text, "utf8") < 64000,
        "complete dossier source, including framing, stays below 64000 bytes");
    } finally {
      rmSync(first, { recursive: true, force: true });
    }
    return;
  }
  try {
    const r = run(first, false);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Need three real dashboard screenshots/);
    assert.equal(existsSync(join(first, "dossier.json")), false);
    assert.throws(
      () => buildDossier(first, { text_max_bytes: 65536 }),
      /holds no image/,
    );
  } finally {
    rmSync(first, { recursive: true, force: true });
  }
});
