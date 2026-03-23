# Testing wp-env-bin

## Running the tests

```bash
npm test
```

This runs all unit tests using the Node.js built-in test runner. No additional dependencies are required.

---

## Test files

Tests live in `tests/` and use the `node:test` module with `node:assert/strict`. Each file is self-contained and requires no test framework configuration.

| File | Module under test | What it covers |
|---|---|---|
| `tests/htaccess.test.js` | `templates/htaccess.tpl` | `.htaccess` template rendering for singlesite and multisite |
| `tests/validate.test.js` | `lib/db.js` | SQL file validation — extension, existence, mysqldump header, WordPress options table |
| `tests/prefix.test.js` | `lib/db.js` | Table prefix renaming — regex escaping, replacement counts, edge cases |
| `tests/compare.test.js` | `lib/compare.js` | CLI arg parsing, URL building, slugify, screenshot classification |
| `tests/install.test.js` | `commands/install.js` | `applyProjectType()` — config mutations for plugin vs theme projects |
| `tests/config.test.js` | `lib/env/config.js` | `readLocalConfig()` — missing file, missing fields, singlesite vs multisite; `readWpEnvJson()` — candidate file resolution |
| `tests/check.test.js` | `lib/env/check.js` | `checkDatabase()`, `checkModifiedDatabase()`, `checkHtaccess()` — file presence detection |
| `tests/plugins.test.js` | `lib/plugins.js` | `readComposerPlugins()` — absent file, vendor/slug extraction, require + require-dev merging |
| `tests/log.test.js` | `lib/utils/log.js` | `logger()` — return vs stdout modes |
| `tests/generate-block-tests.test.js` | `lib/e2e/generate-block-tests.js` | `parseArgs()` — flags and defaults; `generateTestFile()` — output shape and content |
| `tests/block-loader.test.js` | `lib/e2e/block-loader.js` | `sanitizeAttributesForApi()`, `buildContentAssertions()`, `analyseRenderPhp()`, `resolveBlockCss()` |
| `tests/e2e-scaffold.test.js` | `commands/e2e.js` | `scaffoldE2eFiles()` — directory creation, static file copying, `.wp-env.json` / `.env` generation, plugin vs theme projects, idempotency |

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

1. Create `tests/<module-name>.test.js` following the patterns above.
2. The `npm test` script uses a glob (`tests/*.test.js`) — new files are picked up automatically.
3. Run a single file during development:
   ```bash
   node --test tests/<your-file>.test.js
   ```

Functions that require Docker or WP-CLI (e.g., `importDb()`, `searchReplace()`, `getInactiveComposerPlugins()`) are not unit-tested. Test those paths through the full `wp-env-bin` workflow in a live environment.
