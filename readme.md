# wp-env-bin

A CLI tool for managing local WordPress development environments using [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/). It automates pulling a production database, processing it for local use, and configuring a reverse proxy for media assets.

Supports both **single-site** and **multisite** source databases. Works with Pantheon (via Terminus) or any host where you can export a SQL file with `wp db export`. The local environment is always a standard single-site wp-env install.

---

## Requirements

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://www.docker.com/) (required by `@wordpress/env`)
- [`@wordpress/env`](https://www.npmjs.com/package/@wordpress/env) installed in the consuming project
- [Terminus CLI](https://docs.pantheon.io/terminus) authenticated with Pantheon *(only required for Pantheon-hosted sites)*
- [Composer](https://getcomposer.org/)

---

## Installation

Install directly from GitHub as a dev dependency:

```bash
npm install --save-dev hadamlenz/wp-env-bin
```

To install from a specific branch:

```bash
npm install --save-dev hadamlenz/wp-env-bin#dev
```

---

## Recommended `package.json` Scripts

Add these to your project's `package.json` before running setup:

```json
{
  "scripts": {
    "wp-env": "cd wp-env-bin && wp-env",
    "env:install": "wp-env-bin install",
    "env:setup": "wp-env-bin setup",
    "env:get": "wp-env-bin get db",
    "env:process": "wp-env-bin process db",
    "env:htaccess": "wp-env-bin make htaccess",
    "env:sync": "wp-env-bin sync",
    "env:compare": "wp-env-bin compare --url /",
    "env:compare:page": "wp-env-bin compare --url /your-page-path/",
    "env:help": "wp-env-bin help"
  }
}
```

---

## First-Time Setup

### 1. Run the installer

```bash
npm run env:install
```

This scaffolds the `wp-env-bin/` config folder and walks you through creating `wp-env.config.json` interactively:

```
wp-env-bin/
├── .wp-env.json              # WordPress environment Docker config
├── .gitignore                # Ignores generated files
├── assets/                   # Database and .htaccess files (gitignored)
├── wp-env.config.json        # Your local config (gitignored)
├── wp-env.config.json.example
└── composer.json.example
```

The installer will ask for:
- **Site type** — `singlesite` (default) or `multisite`
- **Pantheon site.environment** — e.g. `mysite.live` *(skip if not using Pantheon)*
- **Live site URL** — e.g. `example.com`
- **Plugin or theme name** — pre-filled from your `package.json`
- **Live DB table prefix** and **multisite site ID** — multisite only

### 2. Configure `.wp-env.json`

Edit `wp-env-bin/.wp-env.json` to point to your plugin or theme and set your preferred ports:

```json
{
  "plugins": [".."],
  "env": {
    "development": {
      "port": 8889,
      "mysqlPort": 51600
    }
  }
}
```

### 3. Configure `composer.json`

```bash
cp wp-env-bin/composer.json.example wp-env-bin/composer.json
```

Add your plugin and theme dependencies, then install them:

```bash
npm run env:setup
```

### 4. Start the environment and sync the database

```bash
npm run wp-env start
npm run env:sync
```

---

## Config Reference

`wp-env-bin/wp-env.config.json` is gitignored — never commit it.

**Single-site:**
```json
{
  "siteType": "singlesite",
  "env": "mysite.live",
  "url": "example.com",
  "pluginName": "my-plugin"
}
```

**Multisite** (pulling one subsite from a Pantheon multisite network):
```json
{
  "siteType": "multisite",
  "env": "mysite.live",
  "url": "yoursubsite.example.com",
  "pluginName": "my-plugin",
  "oldPrefix": "wpsites_123_",
  "siteId": "123"
}
```

| Field | Description |
|---|---|
| `siteType` | `"singlesite"` (default) or `"multisite"` |
| `env` | Terminus site.environment — **required for `get db` only** (e.g. `mysite.live`) |
| `url` | Live site domain (e.g. `example.com`) |
| `pluginName` | Plugin or theme name, for reference |
| `oldPrefix` | Live DB table prefix — **multisite only** (e.g. `wpsites_123_`) |
| `siteId` | WordPress multisite site ID — **multisite only** (e.g. `123`) |

---

## Commands

| Command | Description |
|---|---|
| `wp-env-bin install` | Scaffold `wp-env-bin/` config folder and configure interactively |
| `wp-env-bin setup` | Run `composer install` in `wp-env-bin/` to install plugins and themes |
| `wp-env-bin get db` | Export the database from Pantheon via Terminus *(requires `env` in config)* |
| `wp-env-bin use db <path>` | Validate and use a local SQL file instead of downloading from Pantheon |
| `wp-env-bin process db` | Rename table prefix, import DB into local env, run URL search-replace |
| `wp-env-bin make htaccess` | Generate `.htaccess` to reverse-proxy media uploads from the live site |
| `wp-env-bin sync` | Run `get db` + `process db` + `make htaccess` in sequence |
| `wp-env-bin compare` | Visual A/B regression test — screenshot live vs local and diff *(see below)* |
| `wp-env-bin e2e init` | Scaffold `e2e/` block test environment with its own `.wp-env.json` *(see below)* |
| `wp-env-bin e2e generate editor --file=<path>` | Generate Playwright editor tests from a `block.json` file |
| `wp-env-bin e2e generate frontend --file=<path>` | Generate Playwright frontend tests from a `block.json` file |
| `wp-env-bin help` | Show command reference |

---

## Visual Regression Testing (`compare`)

The `compare` command takes a screenshot of the same URL on both the live site and your local environment, runs a pixel-level diff, and generates an HTML report so you can visually confirm that your local copy matches production.

### One-time browser install

Playwright requires a one-time download of its bundled Chromium browser:

```bash
npx playwright install chromium
```

### Usage

**Compare the home page:**
```bash
npm run env:compare
# equivalent: wp-env-bin compare --url /
```

**Compare a specific page:**
```bash
# Edit env:compare:page in package.json to point at your target path, then:
npm run env:compare:page
# equivalent: wp-env-bin compare --url /your-page-path/
```

**Compare directly with any path:**
```bash
wp-env-bin compare --url /about/
wp-env-bin compare --url /research/labs/
```

**Compare multiple pages from the sitemap:**
```bash
wp-env-bin compare --limit 10
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--url <path>` | *(none — uses sitemap)* | Path to compare, e.g. `/about/` |
| `--threshold <n>` | `1` | Pixel diff % above which a page is flagged as a failure |
| `--limit <n>` | `10` | Max pages to pull from sitemap when no `--url` is given |

### Report

After each run, the report is written to:

```
wp-env-bin/compare-report/
├── index.html          # Summary: all pages with diff % and pass/warn/fail status
└── pages/
    └── <slug>/
        ├── live.png    # Screenshot from the live site
        ├── local.png   # Screenshot from localhost
        └── diff.png    # Highlighted pixel diff
```

Open `wp-env-bin/compare-report/index.html` in your browser to review side-by-side screenshots and click into individual pages for a closer look.

### Status thresholds

| Icon | Status | Condition |
|---|---|---|
| ✓ | pass | diff % is below `--threshold` |
| ! | warn | diff % is between `--threshold` and `5 × threshold` |
| ✗ | fail | diff % exceeds `5 × threshold` |

The command exits with code `1` if any pages fail, making it usable in CI.

---

## E2E Block Testing

The `e2e` commands scaffold a self-contained Playwright test environment for Gutenberg blocks. Tests are generated automatically from `block.json` metadata — no test authoring required to get baseline coverage.

Tests use two complementary strategies:

- **Editor tests** — insert the block into a WordPress post in Gutenberg, assert it renders without crashing, validate serialized markup, and verify block supports (color, typography, spacing, anchor, CSS classes), keywords, variations, and styles
- **Frontend tests** — call the WordPress Block Renderer REST API (`/wp/v2/block-renderer`) to render the block's PHP output without creating posts, then run axe WCAG 2.2 AA accessibility scans and assert HTML structure

Both test types run entirely from local data — no remote hosts are contacted during tests.

### Environment isolation

The e2e environment uses a separate `.wp-env.json` (in `e2e/`) with different ports from your development environment, so both can run at the same time:

| Environment | Default port | MySQL port |
|---|---|---|
| Development (`wp-env-bin/`) | `8889` | `51600` |
| E2E tests (`e2e/`) | `8886` | `51606` |

`wp-env` reads the config from whichever directory you run it in, so `cd e2e && npx wp-env start` starts the test environment independently.

### Required devDependencies

Add to your plugin/theme's `package.json`:

```bash
npm install --save-dev \
  @wordpress/e2e-test-utils-playwright \
  @playwright/test \
  @axe-core/playwright \
  typescript \
  source-map-support
```

### First-time setup

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

### Generating tests

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

### Richer test generation with `block.json`

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

### Running tests

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

### Recommended `package.json` scripts for e2e

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

### Writing custom tests

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

The `@e2e/utils/helpers` alias is pre-configured in `e2e/tsconfig.json` to resolve to the `helpers.ts` bundled in `wp-env-bin` — no local copy needed. All other `@e2e/*` paths resolve to `e2e/specs/*`.

Add your custom test files to `playwright.config.ts` projects alongside the generated specs.

### `e2e/` directory structure

```
e2e/
├── .wp-env.json              # Isolated test environment (port 8886)
├── .gitignore                # Ignores vendor/, plugins/, themes/, .auth/, reports
├── composer.json             # Minimal test PHP dependencies (gitignored — copy from .example)
├── composer.json.example     # Template for test PHP deps
├── playwright.config.ts      # Playwright config: testDir ./specs, baseURL :8886
├── tsconfig.json             # Path alias: @e2e/* → specs/*
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

---

## Day-to-Day Workflow

Pull the latest production database and sync your local environment:

```bash
npm run env:sync
```

This runs the full pipeline: exports from Pantheon, renames table prefixes, imports into Docker, runs URL search-replace, and regenerates the media proxy `.htaccess`.

---

## Non-Pantheon / Local SQL File Workflow

If your site is not hosted on Pantheon, export your database using WP-CLI on the server. Use the two-step approach below — it matches what `get db` does internally and ensures only the correct prefixed tables are exported:

**Step 1 — Get the table list:**
```bash
wp db tables --format=csv --url=example.com --all-tables-with-prefix
```

**Step 2 — Export only those tables:**
```bash
wp db export - --url=example.com --tables=$(wp db tables --format=csv --url=example.com --all-tables-with-prefix) > database.sql
```

Replace `example.com` with your live site's URL. The `--url` flag is required for multisite to target the correct subsite. The `--all-tables-with-prefix` flag limits the export to tables matching the site's prefix, which is important on shared or multisite installs.

For a simple single-site install with no shared tables, `wp db export database.sql` also works.

Then use `wp-env-bin use db` to validate and load it locally:

```bash
npm run env:install
npm run wp-env start
wp-env-bin use db /path/to/database.sql
npm run env:process
npm run env:htaccess
```

The `env` field in `wp-env.config.json` is not required for this workflow — only `url` is needed.

`use db` validates the file before copying it by checking for:
- A mysqldump header (`-- MySQL dump` or `-- MariaDB dump`)
- A `CREATE TABLE` statement
- A WordPress `_options` table

---

## How It Works

1. **`get db`** — Uses Terminus to export the site's database from Pantheon to `wp-env-bin/assets/database.sql`
2. **`process db`** — For multisite: renames the subsite's table prefix (e.g. `wpsites_7_`) to `wp_` then imports. For single-site: imports the database directly. Then runs search-replace to swap the live URL for `localhost`
3. **`make htaccess`** — Generates an `.htaccess` file that reverse-proxies media upload requests to the live site, so media appears locally without downloading the full uploads directory. For multisite, proxies from `/wp-content/uploads/sites/{siteId}/`; for single-site, proxies from `/wp-content/uploads/`

---

## Project Structure

```
wp-env-bin/               # Dev environment config (created by wp-env-bin install)
├── .wp-env.json          # Docker environment config — port 8889
├── .gitignore
├── assets/               # Generated files (database exports, .htaccess)
├── compare-report/       # Visual regression report output (gitignored)
│   ├── index.html
│   └── pages/<slug>/     # live.png, local.png, diff.png per page
├── composer.json         # PHP plugin/theme dependencies
└── wp-env.config.json    # Local credentials (gitignored)

e2e/                      # E2e test environment (created by wp-env-bin e2e init)
├── .wp-env.json          # Isolated test environment config — port 8886
├── .gitignore
├── composer.json         # Minimal test PHP dependencies (gitignored)
├── composer.json.example
├── playwright.config.ts  # Playwright config: testDir ./specs, baseURL :8886
├── tsconfig.json         # @e2e/* → specs/*, @e2e/utils/helpers → wp-env-bin package
├── tsconfig.e2e.json
├── plugins/              # Composer-installed test plugins (gitignored)
├── themes/               # Composer-installed test themes (gitignored)
├── snapshots/            # Visual regression baselines
└── specs/
    ├── .auth/            # Playwright session storage (gitignored)
    ├── global.setup.ts
    ├── editor/           # Generated editor spec files
    └── frontend/         # Generated frontend spec files
```

---

## License

ISC — H. Adam Lenz
