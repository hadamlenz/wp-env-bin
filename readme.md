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
| `wp-env-bin e2e init` | Scaffold `e2e/` block test environment with its own `.wp-env.json` |
| `wp-env-bin e2e generate editor --file=<path>` | Generate Playwright editor tests from a `block.json` file |
| `wp-env-bin e2e generate frontend --file=<path>` | Generate Playwright frontend tests from a `block.json` file |
| `wp-env-bin help` | Show command reference |

---

## Documentation

- [**Setup & Configuration**](docs/setup.md) — First-time setup, config reference, day-to-day workflow, non-Pantheon workflow, how it works, project structure
- [**Visual Regression Testing**](docs/compare.md) — `compare` command usage, options, report output
- [**E2E Block Testing**](docs/e2e.md) — Playwright block tests, environment isolation, generating tests, writing custom tests

---

## License

ISC — H. Adam Lenz
