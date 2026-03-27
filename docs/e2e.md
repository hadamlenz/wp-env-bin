# E2E Block Testing

The `e2e` commands scaffold a self-contained Playwright test environment for Gutenberg blocks. Tests are generated automatically from `block.json` metadata — no test authoring required to get baseline coverage.

Tests use two complementary strategies:

- **Editor tests** — insert the block into a WordPress post in Gutenberg, assert it renders without crashing, validate serialized markup, and verify block supports (color, typography, spacing, anchor, CSS classes), keywords, variations, and styles
- **Frontend tests** — call the WordPress Block Renderer REST API (`/wp/v2/block-renderer`) to render the block's PHP output without creating posts, then run axe WCAG 2.2 AA accessibility scans and assert HTML structure

Both test types run entirely from local data — no remote hosts are contacted during tests.

---

## Managed files

Two files in `wp-env-bin/e2e/specs/` are **managed by wp-env-bin** — they are created during `e2e scaffold` and should not be edited:

| File | Purpose |
|---|---|
| `specs/editor/blocks.spec.ts` | Discovery-based editor tests — reads `wp-env-bin.e2e.config.json` at test startup |
| `specs/frontend/blocks.spec.ts` | Discovery-based frontend tests — same config, with screenshots and visual regression enabled |

These files are thin wrappers that call into wp-env-bin's test logic. All test behaviour lives in the package, so updates to the test logic are picked up automatically when you upgrade wp-env-bin — no need to touch these files.

If you upgrade wp-env-bin and the managed spec API changes (rare), refresh them:

```bash
wp-env-bin e2e update
```

This re-copies both managed spec files from the current package version and regenerates `tsconfig.e2e.json` with the correct path to the installed package. User-owned files (`playwright.config.ts`, `.wp-env.json`, `global.setup.ts`) are never touched by `update`.

---

## First-time setup

**1. Scaffold the e2e environment:**

```bash
wp-env-bin e2e scaffold
```

This creates the `wp-env-bin/e2e/` directory and prompts for:
- **Plugin or theme** — determines whether `../..` is loaded as a plugin or theme, and how the `afterStart` lifecycle script is generated
- **Slug** — your plugin or theme slug, pre-filled from `wp-env-bin/wp-env-bin.config.json` if `wp-env-bin config install` has already been run
- **Test theme** *(plugin projects only)* — the theme to activate during tests (default: `twentytwentyfive`)
- WordPress version (default: `6.9.4`)
- PHP version (default: `8.3`)
- Development port (default: `8886`)

The `afterStart` lifecycle script is generated automatically:
- **Plugin**: `wp plugin activate <slug> && wp theme activate <testTheme>`
- **Theme**: `wp theme activate <slug>` — if your `wp-env-bin/e2e/composer.json` includes test plugins, add their activations to `afterStart` in `wp-env-bin/e2e/.wp-env.json` after running `composer install`

**2. Configure block test targets:**

```bash
cp wp-env-bin/e2e/wp-env-bin.e2e.config.json.example wp-env-bin/e2e/wp-env-bin.e2e.config.json
# Edit wp-env-bin/e2e/wp-env-bin.e2e.config.json to add block directories for testing
```

See [Block test configuration](#block-test-configuration) below for the file format.

**3. Configure and install test PHP dependencies:**

```bash
cp wp-env-bin/e2e/composer.json.example wp-env-bin/e2e/composer.json
# Edit wp-env-bin/e2e/composer.json to add test themes/plugins (e.g. a testing theme)
cd wp-env-bin/e2e && composer install
```

The `wp-env-bin/e2e/composer.json` only needs the packages required for testing — keep it minimal. Theme and plugin packages land in `wp-env-bin/e2e/themes/` and `wp-env-bin/e2e/plugins/`, which are mapped into the test WordPress environment.

**4. Install Playwright browser (one-time):**

```bash
npx playwright install chromium
```

**5. Start the test environment:**

```bash
wp-env-bin e2e env start
# Your dev environment (on port 8889) can run simultaneously
```
---

## Block test configuration

After running `wp-env-bin e2e scaffold`, copy the example config and add each block's directory (relative to the project root) to opt it in to testing:

```bash
cp wp-env-bin/e2e/wp-env-bin.e2e.config.json.example wp-env-bin/e2e/wp-env-bin.e2e.config.json
```

```json
{
  "editor": [
    "blocks/accordion",
    "blocks/button"
  ],
  "frontend": [
    "blocks/accordion"
  ]
}
```

| Field | Description |
|---|---|
| `editor` | Block directories to include in editor tests |
| `frontend` | Block directories to include in frontend tests |
| `wpVersion` | WordPress version used in the test environment (default: `"6.9.4"`) |
| `phpVersion` | PHP version used in the test environment (default: `"8.3"`) |
| `testTheme` | Theme activated during tests — plugin projects only (default: `"twentytwentyfive"`) |
| `port` | wp-env HTTP port for the e2e environment (default: `"8886"`) |
| `mysqlPort` | MySQL port for the development e2e environment (default: `51606`) |
| `testMysqlPort` | MySQL port for the tests e2e environment (default: `51607`) |
| `wpConstants` | WordPress constants written to the test environment's `.wp-env.json` `config` block — overrides the entire object |

These fields are all optional. When present they set the defaults shown during `wp-env-bin e2e scaffold` prompts, and `mysqlPort`, `testMysqlPort`, and `wpConstants` are written directly to the generated `.wp-env.json`.

To check the current e2e config and see which blocks are opted in:

```bash
wp-env-bin info e2e config             # show full e2e config
wp-env-bin info e2e config editor      # list blocks opted in to editor tests
wp-env-bin info e2e config frontend    # list blocks opted in to frontend tests
wp-env-bin info e2e config wpVersion   # print the WordPress version in use
```

- A block in `editor` but not `frontend` skips frontend tests (e.g. static blocks or blocks in development).
- `block.json` is always expected at `{dir}/block.json` — this is the WordPress convention.
- Block CSS and `render.php` are read at test startup, so tests always reflect the current state of the source without any regeneration step.

**Hand-authored tests** in `{block}/test/editor.e2e.ts` and `{block}/test/frontend.e2e.ts` are picked up automatically by the playwright config — no extra configuration needed.

---

## Running tests

The test environment must be running before executing tests — see [First-time setup](#first-time-setup) step 5.

```bash
# All tests
wp-env-bin e2e test

# Editor tests only
wp-env-bin e2e test --project=all-blocks-editor

# Frontend tests only
wp-env-bin e2e test --project=all-blocks-frontend

# One block by title
wp-env-bin e2e test --grep "Accordion"

# One block, editor only
wp-env-bin e2e test --project=all-blocks-editor --grep "Accordion"

# Headed mode (see the browser)
wp-env-bin e2e test --headed

# Debug mode (Playwright inspector)
wp-env-bin e2e test --debug

# Open HTML report
cd wp-env-bin/e2e && npx playwright show-report playwright-report
```

---

## Visual regression snapshots

Frontend tests support two screenshot modes, both opt-in:

- **`--screenshots`** — saves a dated PNG of each block after every run, useful for visual documentation. Files land in `wp-env-bin/e2e/test-results/screenshots/frontend/` and are gitignored.
- **`--visual-regression`** — compares each block against a stored baseline PNG using Playwright's `toHaveScreenshot()`. Fails if pixel differences exceed 2%. Baselines are stored in `wp-env-bin/e2e/snapshots/` — **commit this directory** so CI can compare against them.

Enable either flag when generating frontend specs:

```bash
wp-env-bin e2e generate frontend --file=src/blocks/my-block/block.json --visual-regression
wp-env-bin e2e generate frontend --glob="src/blocks/**/block.json" --screenshots
```

### Creating initial baselines

Run frontend tests once — Playwright creates baseline PNGs automatically on the first run:

```bash
wp-env-bin e2e test --project=all-blocks-frontend
```

Then commit the generated baselines:

```bash
git add wp-env-bin/e2e/snapshots/
git commit -m "Add visual regression baselines"
```

### Updating baselines after intentional visual changes

```bash
wp-env-bin e2e test --project=all-blocks-frontend --update-snapshots
```

Commit the updated PNGs and review the diff in your PR to confirm only expected blocks changed.

---

## Environment isolation

The e2e environment uses a separate `.wp-env.json` (in `wp-env-bin/e2e/`) with different ports from your development environment, so both can run at the same time:

| Environment | Default port | MySQL port |
|---|---|---|
| Development (`wp-env-bin/`) | `8889` | `51600` |
| E2E tests (`wp-env-bin/e2e/`) | `8886` | `51606` |

`wp-env` reads the config from whichever directory you run it in. Use `wp-env-bin e2e env start` to start the test environment from the project root.

---

## What `block.json` fields drive test coverage

Both the discovery approach and the generate commands derive assertions from these fields. Add them for better coverage:

```json
{
  "name": "my-block-plugin/my-block",
	"title": "My Block",
  "example": {
    "attributes": {
      "heading": "Hello World",
      "iconName": "star"
    }
  },
  "keywords": ["accordion","collapse","faq"],
  "variations": [{
    "name": "outline",
    "title": "Outline",
    "attributes": {
      "style": "outline"
    }
  }],
  "styles": [{
    "name": "outline",
    "label": "Outline"
  }],
  "supports":{
    "color":true, 
    "typography":true 
  }
}
```

- `name` / `title` — `name` is required; loading aborts without it. It determines the block insertion call and (when using `generate`) the output spec filename (slashes replaced with hyphens, e.g. `my-plugin/my-block` → `my-plugin-my-block.spec.ts`). `title` is optional and falls back to `name`; it becomes the `test.describe` heading — use it with `--grep` for focused runs.
- `example.attributes` — used to insert the block with realistic attribute values; each attribute is asserted in the serialized markup
- `keywords` — each keyword generates a test that searches the block inserter and confirms the block appears
- `variations` — each variation generates an insertion + markup assertion test
- `styles` — each non-default style generates a test that applies the style and confirms the CSS class appears
- `supports` — each enabled support (`color`, `typography`, `spacing`, `anchor`, `customClassName`) generates a test that opens the relevant inspector panel, applies the control, and asserts the resulting CSS class or inline style appears on the block in the editor

Attributes whose `example` value matches their `block.json` default are asserted **absent** from markup (WordPress omits defaults intentionally).

---

## Writing custom tests

The generators cover structural tests automatically. For attribute controls, interactive behaviors, or keyboard navigation, write hand-authored tests in an `editor.e2e.ts` or `frontend.e2e.ts` file alongside your block source and import the shared helpers:

[Editor E2E example file](editor-example.e2e.ts)
[Frontend E2E example file](frontend-example.e2e.ts)

Add your custom test files to `wp-env-bin/e2e/playwright.config.ts` projects alongside the generated specs like this:

```typescript
{
  name:'icon-block',
  use: { ...devices['Desktop Chrome'] },
  testDir: '../../block/icon/test',
  testMatch: ['**/*.e2e.ts'],
  dependencies: ['setup'],//only needed if you need the tests to log into the site
},
```
now you can run the following command to run the icon-block test:
cod
```bash
wp-env-bin e2e test --project=icon-block 
```

---

## Generating static spec files (optional)

The discovery approach above is recommended. If you prefer explicit per-block spec files — for inspection, debugging, or CI snapshot diffs — use the generate commands. Generated specs are written to `wp-env-bin/e2e/specs/editor/` or `wp-env-bin/e2e/specs/frontend/` and must be regenerated when `block.json` changes.

**Generate editor tests for one block:**
```bash
wp-env-bin e2e generate editor --file=src/blocks/my-block/block.json
```

**Generate frontend tests for one block:**
```bash
wp-env-bin e2e generate frontend --file=src/blocks/my-block/block.json
```

**Generate for all blocks at once:**
```bash
wp-env-bin e2e generate editor --glob="src/blocks/**/block.json"
wp-env-bin e2e generate frontend --glob="src/blocks/**/block.json" --screenshots
```

**Options for `generate frontend`:**

| Flag | Description |
|---|---|
| `--screenshots` | Save a dated PNG screenshot of each block during test runs (stored in `wp-env-bin/e2e/test-results/screenshots/frontend/`) |
| `--visual-regression` | Generate `toHaveScreenshot()` tests — baselines created on first run, compared on subsequent runs |
| `--output=<dir>` | Override output directory (defaults: `./wp-env-bin/e2e/specs/editor` or `./wp-env-bin/e2e/specs/frontend` relative to project root) |

---