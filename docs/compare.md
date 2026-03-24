# Visual Regression Testing (`compare`)

The `compare` command takes a screenshot of the same URL on both the live site and your local environment, runs a pixel-level diff, and generates an HTML report so you can visually confirm that your local copy matches production.

## One-time browser install

Playwright requires a one-time download of its bundled Chromium browser:

```bash
npx playwright install chromium
```

## Usage

**Compare the home page:**
```bash
wp-env-bin compare --url /
```

**Compare a specific page:**
```bash
wp-env-bin compare --url /your-page-path/
```

**Compare directly with any path:**
```bash
wp-env-bin compare --url /about/
wp-env-bin compare --url /research/labs/
```

**Compare multiple pages from the sitemap:**
```bash
wp-env-bin compare --limit 10
```

**Compare a curated list of paths from config:**
```bash
wp-env-bin compare --test-paths
```

## Options

| Flag | Default | Description |
|---|---|---|
| `--url <path>` | *(none — uses sitemap)* | Path to compare, e.g. `/about/` |
| `--test-paths` | *(off)* | Read paths from `"test-paths"` in `wp-env-bin.config.json` |
| `--threshold <n>` | `1` | Pixel diff % above which a page is flagged as a failure |
| `--limit <n>` | `10` | Max pages to pull from sitemap when no `--url` is given |

## Configuring `test-paths`

Add a `test-paths` array to `wp-env-bin/wp-env-bin.config.json` listing the paths you want to test. Paths are joined with `url` from the same config to form the full live URL, then diffed against your local environment.

```json
{
  "url": "example.com",
  "test-paths": [
    "/education/pharmd/",
    "/fellowships/",
    "/our-people/office-of-the-dean/"
  ]
}
```

When `--test-paths` is passed, `--url` and `--limit` are ignored — only the paths in the config list are tested.

## Report

After each run, the report is written to `wp-env-bin/compare-reports/{url}-{yyyymmdd-hh:mm}/`. Each run gets its own timestamped folder, so previous reports are preserved. The `index.html` summarizes all pages with their diff percentage and pass/warn/fail status. Each page gets its own subfolder under `pages/<slug>/` containing `live.png`, `local.png`, and `diff.png`.

Open the reported path in your browser to review side-by-side screenshots and click into individual pages for a closer look.

## Status thresholds

| Icon | Status | Condition |
|---|---|---|
| ✓ | pass | diff % is below `--threshold` |
| ! | warn | diff % is between `--threshold` and `5 × threshold` |
| ✗ | fail | diff % exceeds `5 × threshold` |

The command exits with code `1` if any pages fail, making it usable in CI.
