# E2E Block Testing

The `e2e` commands scaffold a self-contained Playwright test environment for Gutenberg blocks. Tests are generated automatically from `block.json` metadata — no test authoring required to get baseline coverage.

Tests use two complementary strategies:

- **Editor tests** — insert the block into a WordPress post in Gutenberg, assert it renders without crashing, validate serialized markup, and verify block supports (color, typography, spacing, anchor, CSS classes), keywords, variations, and styles
- **Frontend tests** — call the WordPress Block Renderer REST API (`/wp/v2/block-renderer`) to render the block's PHP output without creating posts, then run axe WCAG 2.2 AA accessibility scans and assert HTML structure

Both test types run entirely from local data — no remote hosts are contacted during tests.

---

## Environment isolation

The e2e environment uses a separate `.wp-env.json` (in `e2e/`) with different ports from your development environment, so both can run at the same time:

| Environment | Default port | MySQL port |
|---|---|---|
| Development (`wp-env-bin/`) | `8889` | `51600` |
| E2E tests (`e2e/`) | `8886` | `51606` |

`wp-env` reads the config from whichever directory you run it in, so `cd e2e && npx wp-env start` starts the test environment independently.

---

## First-time setup

**1. Scaffold the e2e environment:**

```bash
wp-env-bin e2e init
```

This creates the `e2e/` directory and prompts for:
- WordPress version (default: `6.9.4`)
- PHP version (default: `8.3`)
- `afterStart` lifecycle script — e.g. `wp theme activate my-theme && wp plugin activate my-plugin`
- Development port (default: `8886`)

**2. Configure and install test PHP dependencies:**

```bash
cp e2e/composer.json.example e2e/composer.json
# Edit e2e/composer.json to add test themes/plugins (e.g. a testing theme)
cd e2e && composer install
```

The `e2e/composer.json` only needs the packages required for testing — keep it minimal. Theme and plugin packages land in `e2e/themes/` and `e2e/plugins/`, which are mapped into the test WordPress environment.

**3. Install Playwright browser (one-time):**

```bash
npx playwright install chromium
```

**4. Start the test environment:**

```bash
cd e2e && npx wp-env start
# Your dev environment (on port 8889) can run simultaneously
```

---

## Generating tests

Run from the **project root**. Generated spec files are written to `e2e/specs/editor/` or `e2e/specs/frontend/`.

**Generate editor tests for one block:**
```bash
wp-env-bin e2e generate editor --file=src/blocks/my-block/block.json
```

**Generate frontend tests for one block:**
```bash
wp-env-bin e2e generate frontend --file=src/blocks/my-block/block.json
```

**Generate for all blocks at once (requires `glob` package):**
```bash
npm install --save-dev glob
wp-env-bin e2e generate editor --glob="src/blocks/**/block.json"
wp-env-bin e2e generate frontend --glob="src/blocks/**/block.json" --screenshots
```

**Options for `generate frontend`:**

| Flag | Description |
|---|---|
| `--screenshots` | Save a dated PNG screenshot of each block during test runs (stored in `test-results/screenshots/frontend/`) |
| `--visual-regression` | Generate `toHaveScreenshot()` tests — baselines created on first run, compared on subsequent runs |
| `--output=<dir>` | Override output directory (defaults: `./specs/editor` or `./specs/frontend` relative to project root) |

---

## Richer test generation with `block.json`

The generators parse `block.json` to produce assertions. Add these fields for better coverage:

```json
{
  "example": {
    "attributes": { "heading": "Hello World", "iconName": "star" }
  },
  "keywords": ["accordion", "collapse", "faq"],
  "variations": [{ "name": "outline", "title": "Outline", "attributes": { "style": "outline" } }],
  "styles": [{ "name": "outline", "label": "Outline" }]
}
```

- `example.attributes` — used to insert the block with realistic attribute values; each attribute is asserted in the serialized markup
- `keywords` — each keyword generates a test that searches the block inserter and confirms the block appears
- `variations` — each variation generates an insertion + markup assertion test
- `styles` — each non-default style generates a test that applies the style and confirms the CSS class appears

Attributes whose `example` value matches their `block.json` default are asserted **absent** from markup (WordPress omits defaults intentionally).

---

## Running tests

```bash
# All tests
npx playwright test --config=e2e/playwright.config.ts

# Editor tests only
npx playwright test --config=e2e/playwright.config.ts --project=all-blocks-editor

# Frontend tests only
npx playwright test --config=e2e/playwright.config.ts --project=all-blocks-frontend

# Open HTML report
npx playwright show-report e2e/playwright-report
```

---

## Recommended `package.json` scripts

```json
{
  "scripts": {
    "e2e:env:start":         "cd e2e && npx wp-env start",
    "e2e:env:stop":          "cd e2e && npx wp-env stop",
    "test:e2e":              "playwright test --config=e2e/playwright.config.ts --quiet",
    "test:e2e:editor":       "playwright test --config=e2e/playwright.config.ts --project=all-blocks-editor --quiet",
    "test:e2e:frontend":     "playwright test --config=e2e/playwright.config.ts --project=all-blocks-frontend --quiet",
    "test:e2e:report":       "playwright show-report e2e/playwright-report",
    "e2e:generate:editor":   "wp-env-bin e2e generate editor",
    "e2e:generate:frontend": "wp-env-bin e2e generate frontend"
  }
}
```

---

## Writing custom tests

The generators cover structural tests automatically. For attribute controls, interactive behaviors, or keyboard navigation, write hand-authored tests in a `*.e2e.ts` file alongside your block source and import the shared helpers:

```typescript
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
  createPostAndGetId,
  waitForEditorReady,
  deletePost,
  openInspectorSidebar,
  openStylesTab,
  expandPanel,
} from '@e2e/utils/helpers';

test.describe('My Block - Custom Interactions', () => {
  // ...
});
```

Add your custom test files to `playwright.config.ts` projects alongside the generated specs.

---

## `e2e/` directory structure

```
e2e/
├── .wp-env.json              # Isolated test environment (port 8886)
├── .gitignore                # Ignores vendor/, plugins/, themes/, .auth/, reports
├── composer.json             # Minimal test PHP dependencies (gitignored — copy from .example)
├── composer.json.example     # Template for test PHP deps
├── playwright.config.ts      # Playwright config: testDir ./specs, baseURL :8886
├── tsconfig.json             # Path alias: @e2e/* → specs/*, @e2e/utils/helpers → wp-env-bin
├── tsconfig.e2e.json         # Extends tsconfig.json, includes specs/**/*.ts
├── plugins/                  # Composer-installed test plugins (gitignored)
├── themes/                   # Composer-installed test themes (gitignored)
├── snapshots/                # Visual regression baselines (commit these)
└── specs/
    ├── .auth/                # Playwright session storage (gitignored)
    ├── global.setup.ts       # WordPress admin login → .auth/admin.json
    ├── editor/               # Generated and hand-authored editor spec files
    └── frontend/             # Generated and hand-authored frontend spec files
```
