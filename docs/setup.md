# Setup & Configuration

## First-Time Setup

### 1. Scaffold the `wp-env-bin/` folder

```bash
wp-env-bin scaffold
```

Copies the template files into `wp-env-bin/` in your project root. Safe to re-run — existing files are never overwritten, only missing ones are added.

### 2. Create a site config profile

```bash
wp-env-bin config create
```

Prompts for your site's details and saves them as a named profile in `wp-env-bin/site-configs/`. You'll be asked for:
- **Site type** — `singlesite` (default) or `multisite`
- **Pantheon site.environment** — e.g. `mysite.live` *(leave blank to skip if not using Pantheon)*
- **Live site URL** — e.g. `example.com`
- **Plugin or theme name** — pre-filled from your `package.json`
- **Live DB table prefix** and **multisite site ID** — multisite only

After saving, you'll be prompted to make this the active config. Answering yes runs `config switch` automatically.

### 3. Configure `.wp-env.json`

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

### 4. Configure `composer.json`

```bash
cp wp-env-bin/composer.json.example wp-env-bin/composer.json
```

Add your plugin and theme dependencies to the composer.json, then install them:

```bash
wp-env-bin composer install
```

If you add new packages to `composer.json` after an initial install and get a lock file error (`not present in the lock file`), delete the lock file and reinstall:

```bash
wp-env-bin composer install --delete-lock
```

### 5. Start the environment and sync the database

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
| `composerPath` | Absolute path to `composer.json` on the remote server — used by `composer get` (e.g. `"/code/composer.json"` for Pantheon) |

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

### Creating a profile

```bash
wp-env-bin config create
```

Prompts for site config values and saves them as a named profile. The default profile name is the `url` you enter (e.g. `site.subsite.com`), which produces:

```
wp-env-bin/site-configs/site.subsite.com.wp-env-bin.config.json
```

After saving you'll be asked "Make this the active config now?" — answering yes runs `config switch` automatically, including the reinitialize prompt for multisite environments.

Profile files in `site-configs/` are tracked in git so teammates can share them.

### Switching profiles

```bash
wp-env-bin config switch
```

Displays a list of all profiles in `site-configs/`. The currently active profile is marked **(currently loaded)**. Selecting one copies its files to the active `wp-env-bin.config.json`, `composer.json`, and `composer.lock`.

**Single-site** — after switching, run:

```bash
wp-env-bin composer install --delete-lock
wp-env-bin env sync
wp-env-bin env start
```

**Multisite** — after switching, you'll be asked whether to reinitialize the environment automatically. If you decline (or need to run steps manually):

```bash
wp-env-bin composer install --delete-lock       # reinstall dependencies
wp-env-bin db get                               # re-download from Pantheon
wp-env-bin db process                           # import + search-replace
wp-env-bin htaccess make                        # regenerate from current config
wp-env-bin env run cli plugin activate --all    # activate all plugins
wp-env-bin env start
```

### Deleting a profile

```bash
wp-env-bin config delete
```

Displays a list of all profiles in `site-configs/`. Select one to remove it — you'll be shown which companion files (`.composer.json`, `.composer.lock`) will also be deleted and asked to confirm before anything is removed. The active `wp-env-bin.config.json` is never touched by this command.

### Updating an existing config

```bash
wp-env-bin config update
```

Re-runs the configuration prompts with all existing values pre-filled as defaults. Useful when a site's Pantheon environment, URL, or multisite prefix changes. Offers to save the result as a new or updated named profile.

### Building a composer.json from the remote site

```bash
wp-env-bin composer get
```

Connects to the remote site via Terminus, reads the active plugins (and network-activated plugins for multisite) and the server's own `composer.json`, then cross-references them to generate a companion `{profileName}.composer.json` for the profile. Requires `env` and `composerPath` to be set in the profile config.

The mapping works by matching the plugin's folder name (from `active_plugins`) to the second segment of each Composer package name — for example, `gravityforms/gravityforms.php` → folder `gravityforms` → matches `gravity/gravityforms`. Repositories are carried over from the server's composer.json verbatim.

Plugins not managed by Composer (manually uploaded) appear in an "unmatched" list in the CLI output but are not written to the generated file. After saving, you can add any missing packages manually.

**With a runtime path override** (no `composerPath` required in the profile config):

```bash
wp-env-bin composer get --path /code/composer.json
```

**From a URL** (no Terminus required — fetches the file directly and saves it as-is):

```bash
wp-env-bin composer get --url https://example.com/composer.json
```

**Create a blank companion file** for a profile without fetching anything:

```bash
wp-env-bin composer make
```

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
wp-env-bin scaffold
wp-env-bin config create
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

## Cleaning Up

The `wp-env-bin/themes/`, `plugins/`, and `assets/` directories are fully disposable — they are gitignored and rebuilt on demand. Use the `clean` command to delete them:

```bash
wp-env-bin clean all        # delete themes/, plugins/, and assets/
wp-env-bin clean themes     # delete themes/ only
wp-env-bin clean plugins    # delete plugins/ only
wp-env-bin clean assets     # delete assets/ only
```

**Restore after cleaning:**

```bash
wp-env-bin composer install   # rebuilds themes/ and plugins/
wp-env-bin env sync           # re-downloads DB and regenerates assets/
```

---

## How It Works

1. **`db get`** — Uses Terminus to export the site's database from Pantheon to `wp-env-bin/assets/database.sql`
2. **`db process`** — For multisite: renames the subsite's table prefix (e.g. `wpsites_7_`) to `wp_` then imports. For single-site: imports the database directly. Then runs search-replace to swap the live URL for `localhost`
3. **`htaccess make`** — Generates an `.htaccess` file that reverse-proxies media upload requests to the live site, so media appears locally without downloading the full uploads directory. For multisite, proxies from `/wp-content/uploads/sites/{siteId}/`; for single-site, proxies from `/wp-content/uploads/`. Run `wp-env-bin htaccess put` to re-push the file to the container after an env restart without regenerating it.

