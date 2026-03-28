/**
 * Guards against ESM/CJS format regressions in lib/e2e/.
 *
 * The lib/e2e/ utilities MUST be CommonJS. Consuming projects typically have no
 * "type": "module" in their package.json, so Playwright bundles them in CJS mode.
 * When Node.js follows the symlink from node_modules/wp-env-bin to this repo's
 * real path, it uses wp-env-bin/package.json ("type": "module") to determine the
 * module type — so without the lib/e2e/package.json override, CJS-bundled output
 * is rejected as ESM ("exports is not defined in ES module scope").
 *
 * If any of these tests fail:
 *   - Check that lib/e2e/package.json exists and has { "type": "commonjs" }
 *   - Check that tsconfig.json has "module": "CommonJS"
 *   - Run: npm run build
 *   - Do NOT add import.meta.url to lib/e2e/src/ files
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = path.join(__dirname, "../..");
const E2E_LIB = path.join(ROOT, "lib/e2e");
const E2E_SRC = path.join(E2E_LIB, "src");

// ---------------------------------------------------------------------------
// Package type override
// ---------------------------------------------------------------------------

test("lib/e2e/package.json exists", () => {
	assert.ok(existsSync(path.join(E2E_LIB, "package.json")),
		"lib/e2e/package.json must exist — it overrides the root \"type\": \"module\" for this directory");
});

test("lib/e2e/package.json declares type: commonjs", () => {
	const pkg = JSON.parse(readFileSync(path.join(E2E_LIB, "package.json"), "utf8"));
	assert.equal(pkg.type, "commonjs",
		"lib/e2e/package.json must have \"type\": \"commonjs\" — required so Playwright (CJS mode) can load these files");
});

// ---------------------------------------------------------------------------
// Compiled output is CJS
// ---------------------------------------------------------------------------

const compiledFiles = ["editor-tests.js", "frontend-tests.js", "helpers.js", "block-loader.js"];

for (const file of compiledFiles) {
	test(`lib/e2e/${file} compiles to CJS format`, () => {
		const filePath = path.join(E2E_LIB, file);
		assert.ok(existsSync(filePath), `${file} does not exist — run: npm run build`);
		const content = readFileSync(filePath, "utf8");
		assert.ok(
			content.includes('Object.defineProperty(exports, "__esModule"'),
			`${file} is not CJS — tsconfig.json must have "module": "CommonJS" and npm run build must be run`
		);
	});
}

test("lib/e2e/editor-tests.js exports registerEditorTests and registerEditorTestsFromConfig", () => {
	const content = readFileSync(path.join(E2E_LIB, "editor-tests.js"), "utf8");
	assert.ok(content.includes("exports.registerEditorTests = "), "registerEditorTests must be exported");
	assert.ok(content.includes("exports.registerEditorTestsFromConfig = "), "registerEditorTestsFromConfig must be exported");
});

test("lib/e2e/frontend-tests.js exports registerFrontendTests and registerFrontendTestsFromConfig", () => {
	const content = readFileSync(path.join(E2E_LIB, "frontend-tests.js"), "utf8");
	assert.ok(content.includes("exports.registerFrontendTests = "), "registerFrontendTests must be exported");
	assert.ok(content.includes("exports.registerFrontendTestsFromConfig = "), "registerFrontendTestsFromConfig must be exported");
});

// ---------------------------------------------------------------------------
// Source files must not use ESM-only patterns (lib/e2e/src/ compiles to CJS)
// ---------------------------------------------------------------------------

test("lib/e2e/src/ files do not use import.meta.url", () => {
	const srcFiles = readdirSync(E2E_SRC).filter(f => f.endsWith(".ts"));
	assert.ok(srcFiles.length > 0, "lib/e2e/src/ should contain .ts source files");
	for (const file of srcFiles) {
		const content = readFileSync(path.join(E2E_SRC, file), "utf8");
		assert.ok(
			!content.includes("import.meta.url"),
			`lib/e2e/src/${file} uses import.meta.url — lib/e2e/ compiles to CJS; use the global require instead`
		);
	}
});

test("lib/e2e/src/ files do not use createRequire(import.meta.url)", () => {
	const srcFiles = readdirSync(E2E_SRC).filter(f => f.endsWith(".ts"));
	for (const file of srcFiles) {
		const content = readFileSync(path.join(E2E_SRC, file), "utf8");
		assert.ok(
			!content.includes("createRequire(import.meta.url)"),
			`lib/e2e/src/${file} uses createRequire(import.meta.url) — in CJS context, require is already global`
		);
	}
});
