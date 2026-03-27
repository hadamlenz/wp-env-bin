# wp-env-bin

A CLI tool for managing local WordPress development environments using [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/). It automates pulling a production database, processing it for local use, configuring a reverse proxy for media assets, and scaffolding Playwright e2e tests for Gutenberg blocks. You can also make one-to-one copies of live sites to test against new theme or plugin code.

Supports both **single-site** and **multisite** source databases. Works with Pantheon (via Terminus) or any host where you can export a SQL file with `wp db export`. The local environment is always a standard single-site wp-env install. Block tests run in an isolated wp-env environment with auto-generated specs from `block.json` metadata.

this package is under active development and could maybe not work great. it is at it's core not something you'd use on a live site.

---

## Requirements

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://www.docker.com/) (required by `@wordpress/env`)
- [`@wordpress/env`](https://www.npmjs.com/package/@wordpress/env) installed in the consuming project
- [Terminus CLI](https://docs.pantheon.io/terminus) authenticated with Pantheon *(only required for Pantheon-hosted sites)*
- [Composer](https://getcomposer.org/)

---

## Installation

Install globally from npm:

```bash
npm install -g wp-env-bin
```

> **Note:** wp-env-bin is not yet published to the npm registry. In the meantime, install from GitHub as a dev dependency:
> ```bash
> npm install hadamlenz/wp-env-bin --save-dev
> ```


> or better, clone this repo to any place on your computer an use npm link to use the command
> ```bash
> git clone git@github.com:hadamlenz/wp-env-bin.git
> cd wp-env-bin
> npm link
> wp-env-bin help #should display the help command
> ```

### Optional: single-script fallback

If you prefer not to install globally, add one script to your project's `package.json`:

```json
{
  "scripts": {
    "wp-env-bin": "wp-env-bin"
  }
}
```

Then invoke any command via `npm run wp-env-bin --` followed by the command (the `--` is required to forward arguments):

```bash
npm run wp-env-bin -- env sync
npm run wp-env-bin -- e2e test --project=all-blocks-editor
```

---

## Documentation

- [**Setup & Configuration**](docs/setup.md) — First-time setup, config reference, day-to-day workflow, non-Pantheon workflow, how it works, project structure
- [**Visual Regression Testing**](docs/compare.md) — `visual compare` command usage, options, report output
- [**E2E Block Testing**](docs/e2e.md) — Playwright block tests, environment isolation, generating tests, writing custom tests
- [**Testing wp-env-bin**](docs/testing.md) — Running the unit test suite, test file index, fixtures, and patterns for adding new tests

---

## Commands

### scaffold / help

- **`wp-env-bin scaffold`** — Copy `wp-env-bin/` template files into your project (skips existing files on re-run)
- **`wp-env-bin help`** — Show command reference

### config

- **`config create`** — Prompt for site config values and save as a named profile in `site-configs/`
- **`config switch`** — Pick a named profile from `site-configs/` and activate it
- **`config delete`** — Remove a named profile from `site-configs/`
- **`config update`** — Re-run configuration prompts using existing values as defaults

To inspect the currently active config, use [`info`](#info).

### db

- **`db get`** — Export the database from Pantheon via Terminus *(requires `env` in config)*
- **`db use <path>`** — Validate and use a local SQL file instead of downloading from Pantheon
- **`db process`** — Rename table prefix, import DB into local env, run URL search-replace

### htaccess

- **`htaccess make`** — Generate `.htaccess` to reverse-proxy media uploads from the live site
- **`htaccess put`** — Copy the existing `wp-env-bin/assets/.htaccess` into the running wp-env container

### composer

- **`composer install`** — Run `composer install` in `wp-env-bin/` to install plugins and themes
  - `--delete-lock` — Delete `composer.lock` before installing
- **`composer update`** — Run `composer update` in `wp-env-bin/`
- **`composer get`** — Read active plugins + server composer.json via WP-CLI and build a companion composer.json for a profile
  - `--path <path>` — Override composerPath at runtime (e.g. `--path /code/composer.json`)
  - `--url <url>` — Fetch a composer.json from a URL and save it directly for a profile (no active-plugin matching)
- **`composer make`** — Create a blank companion composer.json for a named profile

### env

- **`env sync`** — Run `db get` + `db process` + `htaccess make` in sequence
- **`env <command>`** — Pass any wp-env command to the dev environment in `wp-env-bin/`

### visual

- **`visual compare --url /`** — Visual A/B regression test — screenshot live vs local and diff
- **`visual compare --url /your-page/`** — Compare a specific page path

### clean

- **`clean all`** — Delete `wp-env-bin/themes/`, `plugins/`, and `assets/`
- **`clean themes`** — Delete `wp-env-bin/themes/`
- **`clean plugins`** — Delete `wp-env-bin/plugins/`
- **`clean assets`** — Delete `wp-env-bin/assets/`

All three directories are disposable — they are recreated by `composer install` (themes/plugins) and `db get`/`db process` (assets).

### info

Inspect the active config files from the command line. Useful for debugging, scripting, and quick reference without opening files.

- **`info`** — List all four config sources with their file paths (flags any that are missing)
- **`info config`** — Show all key-value pairs from `wp-env-bin/wp-env-bin.config.json`, validated against its schema
- **`info composer`** — Show all key-value pairs from `wp-env-bin/composer.json`
- **`info e2e config`** — Show all key-value pairs from `wp-env-bin/e2e/wp-env-bin.e2e.config.json`, validated against its schema
- **`info e2e composer`** — Show all key-value pairs from `wp-env-bin/e2e/composer.json`
- **`info <source> <key>`** — Print just the value of a single key (suitable for scripting)

```bash
# Check what config is active and where all files live
wp-env-bin info

# Inspect the full active site config
wp-env-bin info config

# Pull a single value — useful in scripts
wp-env-bin info config url          # → example.com
wp-env-bin info config siteType     # → multisite
wp-env-bin info e2e config wpVersion
wp-env-bin info composer name
```

### status

Show the active site config and whether the wp-env Docker environment is currently running.

```bash
wp-env-bin status
```

Output:
- **Config** — the loaded `wp-env-bin.config.json` (URL + site type), or "not loaded" if absent
- **Environment** — "running" with the local URL (`http://localhost:8888`), or "not running"

### e2e

- **`e2e scaffold`** — Scaffold `wp-env-bin/e2e/` block test environment with its own `.wp-env.json`
- **`e2e env <command>`** — Pass any wp-env command to the e2e environment in `wp-env-bin/e2e/`
- **`e2e composer install`** — Run `composer install` in `wp-env-bin/e2e/`
- **`e2e composer update`** — Run `composer update` in `wp-env-bin/e2e/`
- **`e2e test`** — Run all Playwright tests from `wp-env-bin/e2e/`
  - `--project=all-blocks-editor` — Editor tests only
  - `--project=all-blocks-frontend` — Frontend tests only
- **`e2e generate editor --file=<path>`** — Generate Playwright editor tests from a `block.json` file
- **`e2e generate frontend --file=<path>`** — Generate Playwright frontend tests from a `block.json` file

---

## Project Structure

Running `wp-env-bin scaffold` and `wp-env-bin e2e scaffold` creates a `wp-env-bin/` folder in your project root. This folder holds all configuration for the wp-env-bin package — it is **not** part of your plugin or theme source and should be treated like a local tooling config directory. The active `wp-env-bin.config.json` and `composer.json` are gitignored; named profiles in `site-configs/` are tracked so teammates can share them.

```
wp-env-bin/
├── .wp-env.json              # wp-env config: maps plugins/themes, sets port 8889 / MySQL 51600
├── .wp-env.override.json     # Per-machine overrides — never commit (gitignored)
├── wp-env-bin.config.json    # Active config — copied from site-configs/ by `config switch` (gitignored)
├── composer.json             # Active PHP deps — copied from site-configs/ by `config switch` (gitignored)
├── composer.json.example     # Starter template — copy to composer.json, then delete
├── site-configs/             # Named config + composer profiles, one per remote site (tracked in git)
│   ├── site.subsite.com.wp-env-bin.config.json
│   ├── site.org.composer.json
│   └── ...                   # Add more profiles with `config create` or `config update`
├── assets/
│   ├── database.sql          # Production DB snapshot downloaded by `db get` (gitignored)
│   ├── database.modified.sql # Processed DB ready for import by `db process` (gitignored)
│   └── .htaccess             # Reverse-proxy rules for media assets (gitignored)
├── plugins/                  # Composer-installed dev plugins — not source-controlled (gitignored)
├── themes/                   # Composer-installed dev themes — not source-controlled (gitignored)
├── vendor/                   # Composer packages (gitignored)
├── compare-report/           # Visual regression HTML reports (gitignored)
└── e2e/
    ├── .wp-env.json          # Isolated test environment: port 8886, MySQL 51606
    ├── .gitignore            # Ignores vendor/, plugins/, themes/, .auth/, test artifacts
    ├── .env                  # WP_BASE_URL override for Playwright (gitignored)
    ├── wp-env-bin.e2e.config.json # Block opt-in list for e2e tests — lists block directories
    ├── composer.json         # PHP test dependencies (copy from .example; gitignored)
    ├── composer.json.example # Starter template for test PHP deps — copy to composer.json, then delete
    ├── playwright.config.ts  # Playwright config: projects, testMatch globs, baseURL :8886
    ├── tsconfig.json         # Path aliases: @e2e/utils/* → wp-env-bin lib
    ├── tsconfig.e2e.json     # Extends tsconfig.json, scoped to specs/**/*.ts
    ├── plugins/              # Composer-installed test plugins (gitignored)
    ├── themes/               # Composer-installed test themes (gitignored)
    ├── vendor/               # Composer packages (gitignored)
    ├── snapshots/            # Visual regression baselines — commit these
    ├── test-results/         # Playwright failure artifacts (gitignored)
    ├── playwright-report/    # HTML test report (gitignored)
    └── specs/
        ├── .auth/            # Saved Playwright session (gitignored)
        ├── global.setup.ts   # Logs in as WordPress admin and saves session
        ├── editor/               # Empty — discovery spec is provided by the wp-env-bin package lib
        └── frontend/             # Empty — discovery spec is provided by the wp-env-bin package lib
```

## License

ISC — H. Adam Lenz
