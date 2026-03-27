/**
 * Print the wp-env-bin command reference to stdout.
 */
function help() {
	console.log(`
wp-env-bin — wp-env scripts and utilities for WordPress plugin and theme development

Usage:
  wp-env-bin <command> [subcommand]

Commands:
  scaffold            Copy wp-env-bin/ template files into your project (new or existing)
  config create       Create a named site config profile and optionally activate it
  config install      [Deprecated] Scaffold + configure in one step (use scaffold + config create)
  config update       Re-run configuration prompts using existing values as defaults
  config switch       Switch the active config + composer.json from a named profile in site-configs/
  config delete       Remove a named profile from site-configs/
  db get              Export the database from Pantheon via Terminus (requires env in config)
  db use <path>       Validate and use a local SQL file (for non-Pantheon hosts)
  db process          Rename table prefix, import DB, and run URL search-replace
  htaccess make       Generate .htaccess with reverse proxy for /wp-content/uploads/
  htaccess put        Copy the existing .htaccess into the running wp-env container
  composer install    Run composer install in wp-env-bin/ to install plugins and themes (same as env setup)
    --delete-lock     Delete composer.lock before installing
  composer update     Run composer update in wp-env-bin/
  composer get        Build composer.json from a remote site's active plugins
    --path <path>     Override composerPath at runtime (e.g. /code/composer.json)
    --url <url>       Fetch a composer.json from a URL and save it directly (no active-plugin matching)
  composer make       Create a blank companion composer.json for a named profile
  e2e composer install  Run composer install in wp-env-bin/e2e/
  e2e composer update   Run composer update in wp-env-bin/e2e/
  env setup           Install required themes and plugins via composer (runs in wp-env-bin/)
    --delete-lock     Delete composer.lock before installing (use when new packages are added)
  env sync            Run db get + db process + htaccess make in sequence
  env <command>       Pass any wp-env command to the dev environment (wp-env-bin/)
  visual compare      Visual A/B regression: screenshot live vs local and diff
    --url <path>      Path to compare (e.g. --url / or --url /about/)
    --threshold <n>   Pixel diff % to flag as failure (default: 1)
    --limit <n>       Max sitemap URLs to test when no --url given (default: 10)
  e2e env <command>   Pass any wp-env command to the e2e environment (wp-env-bin/e2e/)
  e2e scaffold        Scaffold e2e/ block test environment (separate .wp-env.json, Playwright config)
  e2e generate editor --file=<path>    Generate editor Playwright tests from block.json
  e2e generate frontend --file=<path>  Generate frontend Playwright tests from block.json
    --glob=<pattern>  Match multiple block.json files (requires: npm i --save-dev glob)
    --output=<dir>    Override output dir (default: e2e/specs/editor or e2e/specs/frontend)
    --screenshots     Save dated PNG of each block during frontend test runs
    --visual-regression  Generate toHaveScreenshot() visual regression tests
  clean all|themes|plugins|assets  Delete disposable wp-env-bin directories
  info                    List config sources and their file paths
  info config             Show all key-value pairs from wp-env-bin.config.json (validated)
  info composer           Show all key-value pairs from composer.json
  info e2e config         Show all key-value pairs from e2e/wp-env-bin.e2e.config.json (validated)
  info e2e composer       Show all key-value pairs from e2e/composer.json
  info <source> <key>     Print just the value of a single key
  status              Show the active site config and whether wp-env is running
  help                Show this help message

Config files:
  wp-env-bin/wp-env-bin.config.json     Your local config (gitignored — copy from wp-env-bin.config.json.example)
    siteType    "singlesite" or "multisite"                   default: "singlesite"
    env         Terminus site.environment (db get only)        e.g. "mysite.live"
    url         Live site domain                              e.g. "example.com"
    oldPrefix   Live DB table prefix (multisite only)         e.g. "wpsites_7_"
    siteId      WP multisite site ID (multisite only)         e.g. "7"

First-time setup:
  wp-env-bin scaffold
  wp-env-bin config create
  wp-env-bin env setup
  wp-env-bin htaccess make
  wp-env-bin env start
  wp-env-bin env sync

Refresh DB:
  wp-env-bin env sync
`);
}

function configHelp() {
	console.log(`
wp-env-bin config — Manage your wp-env-bin site config profiles

Usage:
  wp-env-bin config <subcommand>

Subcommands:
  create      Prompt for site config values, save to site-configs/, optionally activate
  delete      Remove a named profile from site-configs/
  switch      Pick a named profile from site-configs/ and activate it
  update      Re-run prompts with existing values as defaults
  install     [Deprecated] Use scaffold + config create instead

Config file: wp-env-bin/wp-env-bin.config.json (gitignored)
  siteType    "singlesite" or "multisite"               default: "singlesite"
  env         Terminus site.environment (db get only)   e.g. "mysite.live"
  url         Live site domain                          e.g. "example.com"
  oldPrefix   Live DB table prefix (multisite only)     e.g. "wp_7_"
  siteId      WP multisite site ID (multisite only)     e.g. "7"
`);
}

function scaffoldHelp() {
	console.log(`
wp-env-bin scaffold — Copy wp-env-bin/ template files into your project

Usage:
  wp-env-bin scaffold

Behavior:
  New project    Creates wp-env-bin/ and copies all template files
  Existing       Only copies files that do not yet exist (safe to re-run)

Files scaffolded:
  .wp-env.json                      Standard wp-env config
  .gitignore                        Gitignore rules for wp-env-bin/
  composer.json.example             Composer template (copy and customize)
  wp-env-bin.config.json.example    Config template (copy and customize)
  plugins/wp-env-bin-plugin/        Service worker plugin

After scaffolding:
  wp-env-bin config create      Create and save a site config profile
  wp-env-bin config switch      Activate an existing profile
`);
}

function dbHelp() {
	console.log(`
wp-env-bin db — Database export, import, and processing

Usage:
  wp-env-bin db <subcommand>

Subcommands:
  get           Export the database from Pantheon via Terminus
                  Requires 'env' field in wp-env-bin.config.json
  use <path>    Validate and copy a local SQL file as the database source
  process       Rename table prefix, import DB, and run URL search-replace
                  Requires the wp-env environment to be running (will offer to start it if not)
`);
}

function htaccessHelp() {
	console.log(`
wp-env-bin htaccess — Manage the .htaccess file for the local environment

Usage:
  wp-env-bin htaccess <subcommand>

Subcommands:
  make    Generate .htaccess with a reverse proxy for /wp-content/uploads/
          Proxies media requests to the live site so assets load locally
          without downloading the full uploads directory
  put     Copy wp-env-bin/assets/.htaccess into the running container
          Useful after env restart when the file already exists locally
`);
}

function envHelp() {
	console.log(`
wp-env-bin env — Pass wp-env commands to the dev environment (wp-env-bin/)

Usage:
  wp-env-bin env <command> [args]

Any <command> and [args] are forwarded directly to npx wp-env.

Common commands:
  start                   Start the environment
  stop                    Stop the environment
  destroy                 Remove the environment (deletes volumes)
  logs                    Stream environment logs
  run <container> <cmd>   Run a command inside the environment

Examples:
  wp-env-bin env start
  wp-env-bin env stop
  wp-env-bin env start --update
  wp-env-bin env run tests "wp --info"

See also:
  wp-env-bin e2e env    Manage the e2e test environment
`);
}

function e2eEnvHelp() {
	console.log(`
wp-env-bin e2e env — Pass wp-env commands to the e2e environment (wp-env-bin/e2e/)

Usage:
  wp-env-bin e2e env <command> [args]

Any <command> and [args] are forwarded directly to npx wp-env.

Common commands:
  start                   Start the environment
  stop                    Stop the environment
  destroy                 Remove the environment (deletes volumes)
  logs                    Stream environment logs
  run <container> <cmd>   Run a command inside the environment

Examples:
  wp-env-bin e2e env start
  wp-env-bin e2e env stop
  wp-env-bin e2e env destroy
  wp-env-bin e2e env start --update

See also:
  wp-env-bin env    Manage the dev environment
`);
}

function compareHelp() {
	console.log(`
wp-env-bin visual compare — Visual A/B regression: screenshot live vs local and diff

Usage:
  wp-env-bin visual compare [flags]

Flags:
  --url <path|url>    Compare a single page. Accepts a path (/about/) or a full URL.
                      Omit to pull all URLs from the live site's sitemap.xml instead.
  --test-paths        Read paths from the "test-paths" array in wp-env-bin.config.json
                      and compare each one. Takes precedence over --url and sitemap.
  --limit <n>         Max number of sitemap URLs to test (default: 10)
  --threshold <n>     Pixel diff % used to classify results (default: 1)

Result classification:
  pass  diff% is below --threshold
  warn  diff% is between --threshold and 5× --threshold
  fail  diff% is at or above 5× --threshold

Output:
  Screenshots and an HTML report are written to:
  wp-env-bin/compare-reports/ts/{url}-{yyyymmdd-hh:mm}/index.html

Examples:
  wp-env-bin visual compare                          Test first 10 sitemap URLs
  wp-env-bin visual compare --limit 50               Test first 50 sitemap URLs
  wp-env-bin visual compare --url /                  Compare the homepage only
  wp-env-bin visual compare --url /about/ --threshold 0.5
  wp-env-bin visual compare --test-paths             Compare paths listed in wp-env-bin.config.json
`);
}

function e2eHelp() {
	console.log(`
wp-env-bin e2e — Scaffold and run Playwright block tests for WordPress plugins and themes

Usage:
  wp-env-bin e2e <subcommand> [flags]

Subcommands:
  init                          Scaffold the e2e/ test environment (interactive prompts)
  generate editor  --file=<path>   Generate editor Playwright tests from a block.json file
  generate frontend --file=<path>  Generate frontend Playwright tests from a block.json file
  test [flags]                  Run Playwright tests from wp-env-bin/e2e/

Generate flags:
  --file=<path>         Path to a single block.json file
  --glob=<pattern>      Match multiple block.json files (e.g. --glob="blocks/*/block.json")
  --output=<dir>        Override the output directory
                          default for editor:   e2e/specs/editor
                          default for frontend: e2e/specs/frontend
  --screenshots         Save a dated PNG screenshot of each block during frontend test runs
  --visual-regression   Generate toHaveScreenshot() visual regression assertions

Test flags (forwarded directly to Playwright):
  --project=all-blocks-editor    Run only editor tests
  --project=all-blocks-frontend  Run only frontend tests
  --headed                       Run with browser UI visible
  --debug                        Open Playwright inspector

Examples:
  wp-env-bin e2e scaffold
  wp-env-bin e2e generate editor --file=blocks/my-block/block.json
  wp-env-bin e2e generate frontend --glob="blocks/*/block.json" --screenshots
  wp-env-bin e2e test
  wp-env-bin e2e test --project=all-blocks-editor --headed

First-time setup after init:
  cp wp-env-bin/e2e/composer.json.example wp-env-bin/e2e/composer.json
  cp wp-env-bin/e2e/wp-env-bin.e2e.config.json.example wp-env-bin/e2e/wp-env-bin.e2e.config.json
  cd wp-env-bin/e2e && composer install
  npx playwright install chromium
  cd wp-env-bin e2e env start
  wp-env-bin e2e test
`);
}

function composerHelp() {
	console.log(`
wp-env-bin composer — Run Composer and manage composer.json for site profiles

Usage:
  wp-env-bin composer <subcommand> [flags]

Subcommands:
  install     Run composer install in wp-env-bin/ (same as env setup)
    --delete-lock   Delete composer.lock before installing
  update      Run composer update in wp-env-bin/
  get         Build a composer.json from a remote site's active plugins
  make        Create a blank companion composer.json for a profile
  --          Pass any composer command through to wp-env-bin/
                e.g. wp-env-bin composer -- require wpackagist-plugin/query-monitor
                e.g. wp-env-bin composer -- remove wpackagist-plugin/akismet

get flags:
  --path <path>   Override the composerPath for this run (e.g. /code/composer.json)
                  Takes precedence over the composerPath stored in the profile config
  --url <url>     Fetch a composer.json from a URL and save it directly
                  No active-plugin matching is performed — the file is saved as-is

E2E equivalents:
  wp-env-bin e2e composer install    Run composer install in wp-env-bin/e2e/
  wp-env-bin e2e composer update     Run composer update in wp-env-bin/e2e/
`);
}

function composerE2eHelp() {
	console.log(`
wp-env-bin e2e composer — Run Composer in the e2e test environment (wp-env-bin/e2e/)

Usage:
  wp-env-bin e2e composer <subcommand>

Subcommands:
  install    Run composer install in wp-env-bin/e2e/
  update     Run composer update in wp-env-bin/e2e/

Requires wp-env-bin/e2e/composer.json to exist.
Run \`wp-env-bin e2e scaffold\` first, then copy composer.json.example to composer.json.
`);
}

function cleanHelp() {
	console.log(`
wp-env-bin clean — delete disposable wp-env-bin directories

Usage:
  wp-env-bin clean <subcommand>

Subcommands:
  all       Delete wp-env-bin/themes/, plugins/, and assets/
  themes    Delete wp-env-bin/themes/
  plugins   Delete wp-env-bin/plugins/
  assets    Delete wp-env-bin/assets/
  help      Show this message

Deleted directories are fully regenerated by:
  wp-env-bin composer install   (themes + plugins)
  wp-env-bin db get / db process (assets)
`);
}

function statusHelp() {
	console.log(`
wp-env-bin status — Show the active site config and wp-env running state

Usage:
  wp-env-bin status

Output:
  Config       The loaded wp-env-bin.config.json: URL and site type
               Shows "not loaded" if the file is absent
  Environment  Whether wp-env is running
               If running, prints the local URL (port from .wp-env.json, default 8888)
`);
}

module.exports = { help, configHelp, scaffoldHelp, dbHelp, htaccessHelp, envHelp, e2eEnvHelp, compareHelp, e2eHelp, composerHelp, composerE2eHelp, cleanHelp, statusHelp };
