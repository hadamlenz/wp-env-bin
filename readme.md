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

| Command | Description |
|---|---|
| `wp-env-bin scaffold` | Copy `wp-env-bin/` template files into your project (skips existing files on re-run) |
| `wp-env-bin config create` | Prompt for site config values and save as a named profile in `site-configs/` |
| `wp-env-bin config switch` | Pick a named profile from `site-configs/` and activate it |
| `wp-env-bin config delete` | Remove a named profile from `site-configs/` |
| `wp-env-bin config update` | Re-run configuration prompts using existing values as defaults |
| `wp-env-bin config install` | *(Deprecated)* Scaffold + configure in one step — use `scaffold` + `config create` instead |
| `wp-env-bin db get` | Export the database from Pantheon via Terminus *(requires `env` in config)* |
| `wp-env-bin db use <path>` | Validate and use a local SQL file instead of downloading from Pantheon |
| `wp-env-bin db process` | Rename table prefix, import DB into local env, run URL search-replace |
| `wp-env-bin htaccess make` | Generate `.htaccess` to reverse-proxy media uploads from the live site |
| `wp-env-bin env setup` | Run `composer install` in `wp-env-bin/` to install plugins and themes |
| `wp-env-bin env sync` | Run `db get` + `db process` + `htaccess make` in sequence |
| `wp-env-bin env <command>` | Pass any wp-env command to the dev environment in `wp-env-bin/` |
| `wp-env-bin e2e env <command>` | Pass any wp-env command to the e2e environment in `wp-env-bin/e2e/` |
| `wp-env-bin visual compare --url /` | Visual A/B regression test — screenshot live vs local and diff |
| `wp-env-bin visual compare --url /your-page/` | Compare a specific page path |
| `wp-env-bin e2e init` | Scaffold `wp-env-bin/e2e/` block test environment with its own `.wp-env.json` |
| `wp-env-bin e2e test` | Run all Playwright tests from `wp-env-bin/e2e/` |
| `wp-env-bin e2e test --project=all-blocks-editor` | Run editor tests only |
| `wp-env-bin e2e test --project=all-blocks-frontend` | Run frontend tests only |
| `wp-env-bin e2e generate editor --file=<path>` | Generate Playwright editor tests from a `block.json` file |
| `wp-env-bin e2e generate frontend --file=<path>` | Generate Playwright frontend tests from a `block.json` file |
| `wp-env-bin help` | Show command reference |

---

## Project Structure

Running `wp-env-bin scaffold` and `wp-env-bin e2e init` creates a `wp-env-bin/` folder in your project root. This folder holds all configuration for the wp-env-bin package — it is **not** part of your plugin or theme source and should be treated like a local tooling config directory. The active `wp-env-bin.config.json` and `composer.json` are gitignored; named profiles in `site-configs/` are tracked so teammates can share them.

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
