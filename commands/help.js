function help() {
	console.log(`
wp-env-bin — wp-env subsite testing tool

Usage:
  wp-env-bin <command> [subcommand]

Commands:
  install             Scaffold wp-env-bin/ config folder in the current project
  setup               Install required themes and plugins via composer (runs in wp-env-bin/)
  get db              Export the database from Pantheon via Terminus (requires env in config)
  use db <path>       Validate and use a local SQL file (for non-Pantheon hosts)
  process db          Rename table prefix, import DB, and run URL search-replace
  make htaccess       Generate .htaccess with reverse proxy for /wp-content/uploads/
  sync                Run get db + process db + make htaccess in sequence
  compare             Visual A/B regression: screenshot live vs local and diff
    --url <path>      Path to compare (e.g. --url / or --url /about/)
    --threshold <n>   Pixel diff % to flag as failure (default: 1)
    --limit <n>       Max sitemap URLs to test when no --url given (default: 10)
  help                Show this help message

Config files:
  wp-env-bin/wp-env.config.json     Your local config (gitignored — copy from wp-env.config.json.example)
    siteType    "singlesite" or "multisite"                   default: "singlesite"
    env         Terminus site.environment (get db only)       e.g. "mysite.live"
    url         Live site domain                              e.g. "example.com"
    oldPrefix   Live DB table prefix (multisite only)         e.g. "wpsites_7_"
    siteId      WP multisite site ID (multisite only)         e.g. "7"

First-time setup:
  cp wp-env-bin/wp-env.config.json.example wp-env-bin/wp-env.config.json
  npm run env:setup
  npm run env:htaccess
  npm run wp-env start
  npm run env:sync

Refresh DB:
  npm run env:sync
`);
}

module.exports = { help };
