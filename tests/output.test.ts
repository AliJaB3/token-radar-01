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
    assert.equal(data.watchlist.length, 40);
    assert.equal(data.rows.length, 198);
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
    const text = readFileSync(resolve(root, "dashboard", p), "utf8");
    assert.doesNotMatch(text, /(?:https?:\/\/)/, p);
  }
});

test("interactive views expose every record and connect detail actions to the full snapshot", () => {
  const app = readFileSync(resolve(root, "dashboard/app.js"), "utf8");
  const html = readFileSync(resolve(root, "dashboard/index.html"), "utf8");
  const valuation = readFileSync(
    resolve(root, "dashboard/00-valuation.js"),
    "utf8",
  );
  assert.match(html, /id="scenario-budget"/);
  assert.match(html, /id="scenario-gas"/);
  assert.match(html, /id="scenario-fees"/);
  assert.match(html, /00-valuation\.js/);
  for (const amount of ["50", "100", "250"])
    assert.match(html, new RegExp(`value="${amount}"`));
  assert.match(valuation, /Math\.max\(1, Math\.round\(raw\)\)/);
  assert.match(app, /calculateRadarValue/);
  assert.match(app, /farm_steps/);
  assert.match(app, /valuation_inputs/);
  assert.match(app, /function renderScenario/);
  assert.match(app, /capital \+ .*gas \+ .*protocol fees/);
  assert.match(app, /Total outlay cannot be estimated/);
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
      const helper = readFileSync(
        resolve(root, "dashboard/00-valuation.js"),
        "utf8",
      );
      const app = readFileSync(resolve(root, "dashboard/app.js"), "utf8");
      const html = readFileSync(resolve(root, "dashboard/index.html"), "utf8");
      const css = readFileSync(resolve(root, "dashboard/style.css"), "utf8");
      assert.ok(
        dossier.text.includes(helper),
        "dossier contains the complete executable valuation helper",
      );
      assert.ok(
        dossier.text.includes(app),
        "dossier contains the complete dashboard application source",
      );
      assert.ok(dossier.text.includes(html), "dossier contains the complete HTML source");
      assert.ok(dossier.text.includes(css), "dossier contains the complete CSS source");
      assert.ok(Buffer.byteLength(dossier.text, "utf8") <= 65536,
        "dossier source text, including framing, stays within 65536 bytes");
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
