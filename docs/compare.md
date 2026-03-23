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
npm run env:compare
# equivalent: wp-env-bin compare --url /
```

**Compare a specific page:**
```bash
# Edit env:compare:page in package.json to point at your target path, then:
npm run env:compare:page
# equivalent: wp-env-bin compare --url /your-page-path/
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

## Options

| Flag | Default | Description |
|---|---|---|
| `--url <path>` | *(none — uses sitemap)* | Path to compare, e.g. `/about/` |
| `--threshold <n>` | `1` | Pixel diff % above which a page is flagged as a failure |
| `--limit <n>` | `10` | Max pages to pull from sitemap when no `--url` is given |

## Report

After each run, the report is written to `wp-env-bin/compare-report/`. The `index.html` summarizes all pages with their diff percentage and pass/warn/fail status. Each page gets its own subfolder under `pages/<slug>/` containing `live.png`, `local.png`, and `diff.png`.

Open `wp-env-bin/compare-report/index.html` in your browser to review side-by-side screenshots and click into individual pages for a closer look.

## Status thresholds

| Icon | Status | Condition |
|---|---|---|
| ✓ | pass | diff % is below `--threshold` |
| ! | warn | diff % is between `--threshold` and `5 × threshold` |
| ✗ | fail | diff % exceeds `5 × threshold` |

The command exits with code `1` if any pages fail, making it usable in CI.
