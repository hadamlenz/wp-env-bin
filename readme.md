# wp-env-bin

A CLI tool for managing local WordPress development environments using [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/). It automates pulling a production database, processing it for local use, and configuring a reverse proxy for media assets.

Supports both **single-site** and **multisite** source databases. Works with Pantheon (via Terminus) or any host where you can export a SQL file with `wp db export`. The local environment is always a standard single-site wp-env install.

---

## Requirements

- [Node.js](https://nodejs.org/)
- [Docker](https://www.docker.com/) (required by `@wordpress/env`)
- [`@wordpress/env`](https://www.npmjs.com/package/@wordpress/env) installed in the consuming project
- [Terminus CLI](https://docs.pantheon.io/terminus) authenticated with Pantheon *(only required for Pantheon-hosted sites)*
- [Composer](https://getcomposer.org/)

---

## Installation

Add to your plugin or theme as a dev dependency:

```bash
npm install --save-dev wp-env-bin
```

Or install directly from GitHub:

```bash
npm install --save-dev hadamlenz/wp-env-bin
```

---

## First-Time Setup

### 1. Scaffold the config folder

Run the install command from your project root to create the `wp-env-bin/` config folder:

```bash
wp-env-bin install
```

This creates:

```
wp-env-bin/
├── .wp-env.json              # WordPress environment Docker config
├── .gitignore                # Ignores generated files
├── assets/                   # Database and .htaccess files (gitignored)
├── wp-env.config.json.example
└── composer.json.example
```

### 2. Configure your local environment

Copy the example config and fill in your project values:

```bash
cp wp-env-bin/wp-env.config.json.example wp-env-bin/wp-env.config.json
```

Edit `wp-env-bin/wp-env.config.json`. The required fields depend on your source site type:

**Single-site** (default):
```json
{
  "commandName": "wp-env-bin",
  "pluginName": "your-plugin-name",
  "containerAssetsPath": "/var/www/html/wp-content/wp-env-bin",
  "siteType": "singlesite",
  "env": "your-pantheon-site.live",
  "url": "example.com"
}
```

**Multisite** (pulling one subsite from a Pantheon multisite network):
```json
{
  "commandName": "wp-env-bin",
  "pluginName": "your-plugin-name",
  "containerAssetsPath": "/var/www/html/wp-content/wp-env-bin",
  "siteType": "multisite",
  "env": "your-pantheon-site.live",
  "url": "yoursubsite.example.com",
  "oldPrefix": "wpsites_123_",
  "siteId": "123"
}
```

| Field | Description |
|---|---|
| `siteType` | `"singlesite"` (default) or `"multisite"` |
| `env` | Terminus site.environment identifier — **required for `get db` only** (e.g. `mysite.live`) |
| `url` | Live site domain (e.g. `example.com`) |
| `oldPrefix` | Live DB table prefix — **multisite only** (e.g. `wpsites_123_`) |
| `siteId` | WordPress multisite site ID — **multisite only** (e.g. `123`) |
| `containerAssetsPath` | Path inside the Docker container where assets are mapped — leave as default unless you change the `.wp-env.json` mapping |

> `wp-env.config.json` is gitignored. Never commit it — it contains environment-specific credentials.

### 3. Configure your `.wp-env.json`

Edit `wp-env-bin/.wp-env.json` to match your project. At minimum, update the `plugins` array to point to your plugin and set your preferred ports:

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

### 4. Copy and configure `composer.json`

```bash
cp wp-env-bin/composer.json.example wp-env-bin/composer.json
```

Add your plugin and theme dependencies to `composer.json`, then install them:

```bash
npm run env:setup
```

### 5. Start the environment and sync the database

```bash
npm run wp-env start
npm run env:sync
```

---

## Commands

| Command | Description |
|---|---|
| `wp-env-bin install` | Scaffold `wp-env-bin/` config folder in the current project |
| `wp-env-bin setup` | Run `composer install` in `wp-env-bin/` to install plugins and themes |
| `wp-env-bin get db` | Export the database from Pantheon via Terminus *(requires `env` in config)* |
| `wp-env-bin use db <path>` | Validate and use a local SQL file instead of downloading from Pantheon |
| `wp-env-bin process db` | Rename table prefix, import DB into local env, run URL search-replace |
| `wp-env-bin make htaccess` | Generate `.htaccess` to reverse-proxy media uploads from the live site |
| `wp-env-bin sync` | Run `get db` + `process db` + `make htaccess` in sequence |
| `wp-env-bin help` | Show command reference |

---

## Recommended `package.json` Scripts

Add these to your project's `package.json` for convenient access:

```json
{
  "scripts": {
    "wp-env": "cd wp-env-bin && wp-env",
    "env:setup": "wp-env-bin setup",
    "env:get": "wp-env-bin get db",
    "env:process": "wp-env-bin process db",
    "env:htaccess": "wp-env-bin make htaccess",
    "env:sync": "wp-env-bin sync",
    "env:help": "wp-env-bin help"
  }
}
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

If your site is not hosted on Pantheon, export your database using WP-CLI on the server:

```bash
wp db export database.sql
```

Then use `wp-env-bin use db` to validate and load it locally:

```bash
wp-env-bin use db /path/to/database.sql
npm run wp-env start
wp-env-bin process db
wp-env-bin make htaccess
```

The `env` field in `wp-env.config.json` is not required for this workflow — only `url` is needed (for search-replace and the upload proxy).

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
wp-env-bin/           # Consumer config folder (created by wp-env-bin install)
├── .wp-env.json      # Docker environment config for @wordpress/env
├── .gitignore
├── assets/           # Generated files (database exports, .htaccess)
├── composer.json     # PHP plugin/theme dependencies
└── wp-env.config.json  # Local credentials (gitignored)
```

---

## License

ISC — H. Adam Lenz
