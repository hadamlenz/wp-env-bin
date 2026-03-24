# Setup & Configuration

## First-Time Setup

### 1. Run the installer

```bash
wp-env-bin install
```

This scaffolds the `wp-env-bin/` config folder and walks you through creating `wp-env-bin.config.json` interactively. The installer will ask for:
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

Add your plugin and theme dependencies to the composer.json, then install them:

```bash
wp-env-bin setup
```

### 4. Start the environment and sync the database

```bash
cd wp-env-bin && wp-env start
wp-env-bin sync
```

---

## Config Reference

`wp-env-bin/wp-env-bin.config.json` is gitignored — never commit it.

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
| `adminUsername` | Username for the local admin account created by `process db` (default: `"admin"`) |
| `adminEmail` | Email for the local admin account (default: `"admin@localhost.com"`) |
| `adminPassword` | Password for the local admin account (default: `"password"`) |

---

## Day-to-Day Workflow

Pull the latest production database and sync your local environment:

```bash
wp-env-bin sync
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
wp-env-bin install
cd wp-env-bin && wp-env start
wp-env-bin use db /path/to/database.sql
wp-env-bin process db
wp-env-bin make htaccess
```

The `env` field in `wp-env-bin.config.json` is not required for this workflow — only `url` is needed.

`use db` validates the file before copying it by checking for:
- A mysqldump header (`-- MySQL dump` or `-- MariaDB dump`)
- A `CREATE TABLE` statement
- A WordPress `_options` table

---

## How It Works

1. **`get db`** — Uses Terminus to export the site's database from Pantheon to `wp-env-bin/assets/database.sql`
2. **`process db`** — For multisite: renames the subsite's table prefix (e.g. `wpsites_7_`) to `wp_` then imports. For single-site: imports the database directly. Then runs search-replace to swap the live URL for `localhost`
3. **`make htaccess`** — Generates an `.htaccess` file that reverse-proxies media upload requests to the live site, so media appears locally without downloading the full uploads directory. For multisite, proxies from `/wp-content/uploads/sites/{siteId}/`; for single-site, proxies from `/wp-content/uploads/`

