# Testing wp-env-bin

## Running the tests

```bash
npm test
```

This runs all unit tests using the Node.js built-in test runner. No additional dependencies are required.

---

## Test files

Tests live in `tests/` and use the `node:test` module with `node:assert/strict`. Each file is self-contained and requires no test framework configuration.

All test files live in `tests/unit-tests/`.

| File | Module under test | What it covers |
|---|---|---|
| `htaccess.test.js` | `templates/htaccess.tpl` | `.htaccess` template rendering for singlesite and multisite |
| `validate.test.js` | `lib/db.js` | SQL file validation — extension, existence, mysqldump header, WordPress options table |
| `validate-edge.test.js` | `lib/db.js` | Additional `validateSqlFile()` edge cases — MariaDB headers, data-only exports, custom prefixes |
| `prefix.test.js` | `lib/db.js` | Table prefix renaming — regex escaping, replacement counts, edge cases |
| `compare.test.js` | `lib/compare.js` | CLI arg parsing, URL building, slugify, screenshot classification |
| `diff.test.js` | `lib/compare.js` | `diffScreenshots()` — PNG diffing, pixel counts, dimension handling |
| `report.test.js` | `lib/compare.js` | `writeReport()` — HTML report generation, pass/warn/fail/error counts, per-page files |
| `install.test.js` | `commands/install.js` | `applyProjectType()` — config mutations for plugin vs theme projects |
| `config.test.js` | `lib/env/config.js` | `readLocalConfig()` — missing file, missing fields, singlesite vs multisite; `readWpEnvJson()` — candidate file resolution |
| `check.test.js` | `lib/env/check.js` | `checkDatabase()`, `checkModifiedDatabase()`, `checkHtaccess()` — file presence detection |
| `plugins.test.js` | `lib/plugins.js` | `readComposerPlugins()` — absent file, vendor/slug extraction, require + require-dev merging |
| `log.test.js` | `lib/utils/log.js` | `logger()` — return vs stdout modes |
| `remote-wp.test.js` | `lib/utils/run.js` | `buildRemoteCmd()` — all three host types (pantheon/ssh/wpvip), default fallback, unknown host error |
| `remote-composer.test.js` | `lib/remote-composer.js` | `matchActivePlugins()`, `buildComposerJson()`, `makeComposerName()` — package matching, composer.json assembly |
| `commands-config.test.js` | `commands/config.js` | `configCreate()`, `configDelete()`, `configSwitch()` — profile file management, companion files, active config isolation |
| `scaffold.test.js` | `commands/scaffold.js` | `scaffoldFiles()`, `scaffoldCommand()` — file creation, skip-existing idempotency, return shape |
| `generate-block-tests.test.js` | `lib/e2e/generate-block-tests.js` | `parseArgs()` — flags and defaults; `generateTestFile()` — output shape and content |
| `block-loader.test.js` | `lib/e2e/block-loader.js` | `sanitizeAttributesForApi()`, `buildContentAssertions()`, `analyseRenderPhp()`, `resolveBlockCss()` |
| `e2e-scaffold.test.js` | `commands/e2e.js` | `scaffoldE2eFiles()` — directory creation, static file copying, `.wp-env.json` / `.env` generation, plugin vs theme projects, idempotency |

---

## Test fixtures

`tests/fixtures/` contains static files used by `block-loader.test.js` and `generate-block-tests.test.js`:

```
tests/fixtures/
├── full.block.json         # Static block with example.attributes, keywords, variations, styles, supports
└── dynamic/
    ├── block.json          # Dynamic block with a "render" field pointing to render.php
    └── render.php          # PHP template using $attributes, get_block_wrapper_attributes, aria-*, wp-interactivity
```

---

## Test patterns

Tests that read from `process.cwd()` (e.g., `config.test.js`, `check.test.js`, `plugins.test.js`) create a temporary directory via `mkdtempSync` and use `process.chdir()` inside `before`/`after` hooks to isolate each test file from the project root:

```js
before(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-test-"));
    savedCwd = process.cwd();
    process.chdir(tmpDir);
});

after(() => {
    process.chdir(savedCwd);
    rmSync(tmpDir, { recursive: true });
});
```

Because `node --test` runs test files sequentially, `process.chdir()` is safe within a single file. Do not parallelize test files that use this pattern.

---

## Adding new tests

1. Create `tests/unit-tests/<module-name>.test.js` following the patterns above.
2. The `npm test` script uses a glob (`tests/unit-tests/*.test.js`) — new files are picked up automatically.
3. Use `const ROOT = path.join(__dirname, "../..")` at the top of every test file to resolve the project root.
4. Run a single file during development:
   ```bash
   node --test tests/unit-tests/<your-file>.test.js
   ```

Functions that require Docker or WP-CLI (e.g., `importDb()`, `searchReplace()`, `getInactiveComposerPlugins()`) are not unit-tested. Test those paths through the full `wp-env-bin` workflow in a live environment.

---

## E2E block tests and visual regression

The unit tests above cover the wp-env-bin package itself. For running Playwright block tests in a consuming project — including visual regression snapshots — see [E2E Block Testing](e2e.md).
