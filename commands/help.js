/**
 * Print the wp-env-bin command reference to stdout.
 */
function help() {
	console.log(`
wp-env-bin — wp-env scripts and utilities for WordPress plugin and theme development

Usage:
  wp-env-bin <command> [subcommand]

Commands:
  install             Scaffold wp-env-bin/ config folder in the current project
  setup               Install required themes and plugins via composer (runs in wp-env-bin/)
    --delete-lock     Delete composer.lock before installing (use when new packages are added)
  get db              Export the database from Pantheon via Terminus (requires env in config)
  use db <path>       Validate and use a local SQL file (for non-Pantheon hosts)
  process db          Rename table prefix, import DB, and run URL search-replace
  make htaccess       Generate .htaccess with reverse proxy for /wp-content/uploads/
  sync                Run get db + process db + make htaccess in sequence
  env <command>       Pass any wp-env command to the dev environment (wp-env-bin/)
  compare             Visual A/B regression: screenshot live vs local and diff
    --url <path>      Path to compare (e.g. --url / or --url /about/)
    --threshold <n>   Pixel diff % to flag as failure (default: 1)
    --limit <n>       Max sitemap URLs to test when no --url given (default: 10)
  e2e env <command>   Pass any wp-env command to the e2e environment (wp-env-bin/e2e/)
  e2e init            Scaffold e2e/ block test environment (separate .wp-env.json, Playwright config)
  e2e generate editor --file=<path>    Generate editor Playwright tests from block.json
  e2e generate frontend --file=<path>  Generate frontend Playwright tests from block.json
    --glob=<pattern>  Match multiple block.json files (requires: npm i --save-dev glob)
    --output=<dir>    Override output dir (default: e2e/specs/editor or e2e/specs/frontend)
    --screenshots     Save dated PNG of each block during frontend test runs
    --visual-regression  Generate toHaveScreenshot() visual regression tests
  help                Show this help message

Config files:
  wp-env-bin/wp-env-bin.config.json     Your local config (gitignored — copy from wp-env-bin.config.json.example)
    siteType    "singlesite" or "multisite"                   default: "singlesite"
    env         Terminus site.environment (get db only)       e.g. "mysite.live"
    url         Live site domain                              e.g. "example.com"
    oldPrefix   Live DB table prefix (multisite only)         e.g. "wpsites_7_"
    siteId      WP multisite site ID (multisite only)         e.g. "7"

First-time setup:
  cp wp-env-bin/wp-env-bin.config.json.example wp-env-bin/wp-env-bin.config.json
  wp-env-bin setup
  wp-env-bin make htaccess
  npx wp-env start
  wp-env-bin sync

Refresh DB:
  wp-env-bin sync
`);
}

module.exports = { help };
