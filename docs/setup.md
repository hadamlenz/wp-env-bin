# Setup & Configuration

## First-Time Setup

### 1. Run the installer

```bash
wp-env-bin config install
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
wp-env-bin env setup
```

If you add new packages to `composer.json` after an initial install and get a lock file error (`not present in the lock file`), delete the lock file and reinstall:

```bash
wp-env-bin env setup --delete-lock
```

### 4. Start the environment and sync the database

```bash
wp-env-bin env start
wp-env-bin env sync
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
| `env` | Terminus site.environment — **required for `db get` only** (e.g. `mysite.live`) |
| `url` | Live site domain (e.g. `example.com`) |
| `pluginName` | Plugin or theme name, for reference |
| `oldPrefix` | Live DB table prefix — **multisite only** (e.g. `wpsites_123_`) |
| `siteId` | WordPress multisite site ID — **multisite only** (e.g. `123`) |
| `adminUsername` | Username for the local admin account created by `db process` (default: `"admin"`) |
| `adminEmail` | Email for the local admin account (default: `"admin@localhost.com"`) |
| `adminPassword` | Password for the local admin account (default: `"password"`) |

---

## Day-to-Day Workflow

Pull the latest production database and sync your local environment:

```bash
wp-env-bin env sync
```

This runs the full pipeline: exports from Pantheon, renames table prefixes, imports into Docker, runs URL search-replace, and regenerates the media proxy `.htaccess`.

---

## Managing Multiple Site Configs

When you work against multiple remote sites, you can store a named profile for each one in `wp-env-bin/site-configs/`. The active `wp-env-bin.config.json` and `composer.json` are always plain copies of whichever profile is active.

### Saving a profile

After running `wp-env-bin config install` or `wp-env-bin config update`, you are prompted to save the current config as a named profile. The default profile name is the `url` value (e.g., `site.subsite.com`), which produces:

```
wp-env-bin/site-configs/site.subsite.com.wp-env-bin.config.json
wp-env-bin/site-configs/site.subsite.com.composer.json      (optional)
wp-env-bin/site-configs/site.subsite.com.composer.lock      (optional)
```

Profile files in `site-configs/` are tracked in git so teammates can share them.

### Switching profiles

```bash
wp-env-bin config switch
```

Displays a list of all profiles in `site-configs/`. The currently active profile is marked **(currently loaded)**. Selecting one copies its files to the active `wp-env-bin.config.json`, `composer.json`, and `composer.lock`.

**Single-site** — after switching, run:

```bash
wp-env-bin env setup --delete-lock
wp-env-bin env sync
wp-env-bin env start
```

**Multisite** — after switching, you'll be asked whether to reinitialize the environment automatically. If you decline (or need to run steps manually):

```bash
wp-env-bin env setup --delete-lock       # reinstall dependencies
wp-env-bin db get                        # re-download from Pantheon
wp-env-bin db process                    # import + search-replace
wp-env-bin htaccess make                 # regenerate from current config
wp-env-bin env sync                      # activate composer plugins
wp-env-bin env start
```

### Updating an existing config

```bash
wp-env-bin config update
```

Re-runs the configuration prompts with all existing values pre-filled as defaults. Useful when a site's Pantheon environment, URL, or multisite prefix changes. Offers to save the result as a new or updated named profile.

---

## Non-Pantheon / Local SQL File Workflow

If your site is not hosted on Pantheon, export your database using WP-CLI on the server. Use the two-step approach below — it matches what `db get` does internally and ensures only the correct prefixed tables are exported:

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

Then use `wp-env-bin db use` to validate and load it locally:

```bash
wp-env-bin config install
wp-env-bin env start
wp-env-bin db use /path/to/database.sql
wp-env-bin db process
wp-env-bin htaccess make
```

The `env` field in `wp-env-bin.config.json` is not required for this workflow — only `url` is needed.

`db use` validates the file before copying it by checking for:
- A mysqldump header (`-- MySQL dump` or `-- MariaDB dump`)
- A `CREATE TABLE` statement
- A WordPress `_options` table

---

## How It Works

1. **`db get`** — Uses Terminus to export the site's database from Pantheon to `wp-env-bin/assets/database.sql`
2. **`db process`** — For multisite: renames the subsite's table prefix (e.g. `wpsites_7_`) to `wp_` then imports. For single-site: imports the database directly. Then runs search-replace to swap the live URL for `localhost`
3. **`htaccess make`** — Generates an `.htaccess` file that reverse-proxies media upload requests to the live site, so media appears locally without downloading the full uploads directory. For multisite, proxies from `/wp-content/uploads/sites/{siteId}/`; for single-site, proxies from `/wp-content/uploads/`

