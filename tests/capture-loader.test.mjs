import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const capture = readFileSync(resolve(root, 'tests/capture.mjs'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));

test('capture loads its pinned Playwright package without environment-selected code', () => {
  assert.match(capture, /import\s*\{\s*chromium\s*\}\s*from\s*['"]playwright['"]/);
  assert.doesNotMatch(capture, /PLAYWRIGHT_MODULE|import\s*\(\s*(?:process\.env|modulePath)/);
  assert.equal(packageJson.devDependencies.playwright, '1.64.1');
  assert.equal(lock.packages['node_modules/playwright'].version, '1.64.1');
});
