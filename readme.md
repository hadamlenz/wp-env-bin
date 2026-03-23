# wp-env-bin

A CLI tool for managing local WordPress development environments using [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/). It automates pulling a production database, processing it for local use, configuring a reverse proxy for media assets, and scaffolding Playwright e2e tests for Gutenberg blocks.

Supports both **single-site** and **multisite** source databases. Works with Pantheon (via Terminus) or any host where you can export a SQL file with `wp db export`. The local environment is always a standard single-site wp-env install. Block tests run in an isolated wp-env environment with auto-generated specs from `block.json` metadata.

---

## Requirements

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://www.docker.com/) (required by `@wordpress/env`)
- [`@wordpress/env`](https://www.npmjs.com/package/@wordpress/env) installed in the consuming project
- [Terminus CLI](https://docs.pantheon.io/terminus) authenticated with Pantheon *(only required for Pantheon-hosted sites)*
- [Composer](https://getcomposer.org/)

---

## Installation

Install directly from GitHub as a dev dependency, until we can get on [nmpjs.com](https://www.npmjs.com/), you will also need to run this to update

```bash
npm install --save-dev hadamlenz/wp-env-bin
```
---

## Documentation

- [**Setup & Configuration**](docs/setup.md) — First-time setup, config reference, day-to-day workflow, non-Pantheon workflow, how it works, project structure
- [**Visual Regression Testing**](docs/compare.md) — `compare` command usage, options, report output
- [**E2E Block Testing**](docs/e2e.md) — Playwright block tests, environment isolation, generating tests, writing custom tests

---

## Recommended `package.json` Scripts

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
| `wp-env-bin compare` | Visual A/B regression test — screenshot live vs local and diff |
| `wp-env-bin e2e init` | Scaffold `wp-env-bin/e2e/` block test environment with its own `.wp-env.json` |
| `wp-env-bin e2e generate editor --file=<path>` | Generate Playwright editor tests from a `block.json` file |
| `wp-env-bin e2e generate frontend --file=<path>` | Generate Playwright frontend tests from a `block.json` file |
| `wp-env-bin help` | Show command reference |

---

## Project Structure

Running `wp-env-bin install` and `wp-env-bin e2e init` creates a `wp-env-bin/` folder in your project root. This folder holds all configuration for the wp-env-bin package — it is **not** part of your plugin or theme source and should be treated like a local tooling config directory. Most files inside it are gitignored; only the non-sensitive config files (`.wp-env.json`, `composer.json`, `wp-env-bin.config.json`, `wp-env-bin.e2e.config.json`, `playwright.config.ts`, etc.) should be committed.

```
wp-env-bin/
├── .wp-env.json              # wp-env config: maps plugins/themes, sets port 8889 / MySQL 51600
├── .wp-env.override.json     # Per-machine overrides — never commit (gitignored)
├── wp-env-bin.config.json    # wp-env-bin settings: slug, projectType, Pantheon site ID (gitignored)
├── composer.json             # PHP plugins/themes to install in the dev environment
├── composer.json.example     # Starter template — copy to composer.json, then delete
├── assets/
│   ├── database.sql          # Production DB snapshot downloaded by `get db` (gitignored)
│   ├── database.modified.sql # Processed DB ready for import by `process db` (gitignored)
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
