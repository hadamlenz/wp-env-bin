/**
 * @file frontend-tests.ts
 * @description Registers Playwright front-end tests for a WordPress block using
 * the Block Renderer REST API (/wp/v2/block-renderer).
 *
 * Call registerFrontendTests(test, config) in a generated spec file.
 * The config is derived from block.json and render.php at generation time.
 *
 * @example
 * import { test } from '@wordpress/e2e-test-utils-playwright';
 * import { registerFrontendTests } from '@e2e/utils/frontend-tests';
 * registerFrontendTests(test, { blockName: 'my/block', title: 'My Block', apiAttributes: {}, ... });
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { FrontendTestConfig } from './types';
import { loadFrontendConfig } from './block-loader';
import type { FrontendLoadOptions } from './block-loader';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function deriveWrapperClass(blockName: string): string {
  return `wp-block-${blockName.replace('/', '-')}`;
}

function logAxeViolations(blockTitle: string, violations: any[]): void {
  if (!violations.length) return;
  console.log(`\nAxe violations for ${blockTitle}:`);
  violations.forEach((v: any) => {
    console.log(`  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description}`);
    console.log(`  Help: ${v.helpUrl}`);
    v.nodes.forEach((n: any) => {
      console.log(`    Element: ${n.html}`);
      if (n.failureSummary) console.log(`    Fix:     ${n.failureSummary}`);
    });
  });
}

function isSkippableError(err: any): boolean {
  return (
    err?.status === 400 ||
    err?.status === 404 ||
    err?.code === 'block_invalid_context' ||
    err?.code === 'block_invalid'
  );
}

/**
 * Calls the Block Renderer REST API, loads the rendered HTML into the page,
 * and optionally saves a screenshot. Returns the rendered HTML string.
 * Returns null if the test should be skipped (block requires post context etc.)
 */
async function fetchAndRenderBlock(
  page: Page,
  requestUtils: any,
  config: FrontendTestConfig,
): Promise<string | null> {
  const encodedName = config.blockName.replace('/', '%2F');

  let rendered: { rendered: string };
  try {
    rendered = await requestUtils.rest({
      method: 'POST',
      path:   `/wp/v2/block-renderer/${encodedName}`,
      data:   {
        attributes: config.apiAttributes,
        context:    'edit',
      },
    }) as { rendered: string };
  } catch (err: any) {
    if (isSkippableError(err)) return null;
    throw err;
  }

  expect(rendered.rendered.trim()).not.toBe('');

  const cssTag = config.blockCss
    ? `<style>${config.blockCss}</style>`
    : '<!-- No block CSS found — add a "file:" style ref in block.json for accurate contrast -->';

  await page.setContent(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${cssTag}
</head>
<body>
  ${rendered.rendered}
</body>
</html>`, { waitUntil: 'domcontentloaded' });

  return rendered.rendered;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers the full suite of front-end Playwright tests for a block using
 * the WordPress Block Renderer REST API.
 *
 * Tests registered:
 * - REST API health check (200, non-empty HTML)
 * - Block wrapper class presence
 * - HTML structure assertions (derived from render.php at generation time)
 * - Valid markup (wrapper attached to parsed DOM)
 * - Axe WCAG 2.2 AA scan
 * - Colour contrast check
 * - ARIA violations check
 * - Interactive block axe scan + keyboard accessibility (if hasInteractiveDirectives)
 * - Visual regression (if config.visualRegression)
 *
 * @param test   - The test instance from @wordpress/e2e-test-utils-playwright
 * @param config - Block configuration derived from block.json and render.php
 */
export function registerFrontendTests(test: any, config: FrontendTestConfig): void {
  const {
    blockName,
    title,
    apiAttributes,
    htmlElements = [],
    ariaAttributes = [],
    contentAssertions = [],
    hasInteractiveDirectives = false,
    blockCss = null,
    screenshots = false,
    visualRegression = false,
  } = config;

  const wrapperClass = deriveWrapperClass(blockName);
  const encodedName  = blockName.replace('/', '%2F');

  test.describe(`${title} - Front End (Block Renderer API)`, () => {

    // -----------------------------------------------------------------------
    // REST API health
    // -----------------------------------------------------------------------

    test('block renderer API returns 200 with non-empty HTML', async ({ requestUtils }: any) => {
      test.setTimeout(10_000);

      let rendered: { rendered: string };
      try {
        rendered = await requestUtils.rest({
          method: 'POST',
          path:   `/wp/v2/block-renderer/${encodedName}`,
          data:   { attributes: apiAttributes, context: 'edit' },
        }) as { rendered: string };
      } catch (err: any) {
        if (isSkippableError(err)) {
          console.log('Block not renderable via REST API (static block or requires post context) — skipped.');
          test.skip();
          return;
        }
        throw err;
      }

      expect(typeof rendered.rendered).toBe('string');
      expect(rendered.rendered.trim()).not.toBe('');
    });

    test('rendered HTML contains the block wrapper class', async ({ requestUtils }: any) => {
      test.setTimeout(10_000);

      let rendered: { rendered: string };
      try {
        rendered = await requestUtils.rest({
          method: 'POST',
          path:   `/wp/v2/block-renderer/${encodedName}`,
          data:   { attributes: apiAttributes, context: 'edit' },
        }) as { rendered: string };
      } catch (err: any) {
        if (isSkippableError(err)) { test.skip(); return; }
        throw err;
      }

      // Every block should output an element with its registered wrapper class.
      // If this fails, check that render.php calls get_block_wrapper_attributes().
      expect(rendered.rendered).toContain(wrapperClass);
    });

    // -----------------------------------------------------------------------
    // Rendered HTML structure (derived from render.php at generation time)
    // -----------------------------------------------------------------------

    test('rendered HTML has correct structure', async ({ page, requestUtils }: any) => {
      test.setTimeout(15_000);

      const rendered = await fetchAndRenderBlock(page, requestUtils, config);
      if (rendered === null) { test.skip(); return; }

      if (screenshots) {
        const screenshotDir  = 'test-results/screenshots/frontend';
        const screenshotDate = new Date().toISOString().split('T')[0];
        const screenshotPath = `${screenshotDir}/${wrapperClass}-${screenshotDate}.png`;
        const blockEl = page.locator(`.${wrapperClass}`);
        await blockEl.waitFor({ state: 'attached' });
        if (await blockEl.isVisible()) {
          await blockEl.screenshot({ path: screenshotPath, animations: 'disabled' });
          console.log(`📸  Screenshot saved: ${screenshotPath}`);
        }
      }

      const block = page.locator(`.${wrapperClass}`);
      await expect(block).toBeAttached();

      // img — alt attribute presence (WCAG 1.1.1)
      if (htmlElements.includes('img')) {
        const images   = block.locator('img');
        const imgCount = await images.count();
        for (let i = 0; i < imgCount; i++) {
          const alt = await images.nth(i).getAttribute('alt');
          expect(alt, `img[${i}] must have an alt attribute`).not.toBeNull();
        }
      }

      // a — accessible name presence (WCAG 2.4.4)
      if (htmlElements.includes('a')) {
        const links     = block.locator('a');
        const linkCount = await links.count();
        for (let i = 0; i < linkCount; i++) {
          const text           = (await links.nth(i).innerText()).trim();
          const ariaLabel      = await links.nth(i).getAttribute('aria-label');
          const ariaLabelledBy = await links.nth(i).getAttribute('aria-labelledby');
          expect(
            text || ariaLabel || ariaLabelledBy,
            `a[${i}] must have an accessible name`
          ).toBeTruthy();
        }
      }

      // button — accessible name presence (WCAG 4.1.2)
      if (htmlElements.includes('button')) {
        const buttons  = block.locator('button');
        const btnCount = await buttons.count();
        for (let i = 0; i < btnCount; i++) {
          const text      = (await buttons.nth(i).innerText()).trim();
          const ariaLabel = await buttons.nth(i).getAttribute('aria-label');
          expect(
            text || ariaLabel,
            `button[${i}] must have an accessible name`
          ).toBeTruthy();
        }
      }

      // svg — aria-hidden or title (WCAG 1.1.1)
      if (htmlElements.includes('svg')) {
        const svgs     = block.locator('svg');
        const svgCount = await svgs.count();
        for (let i = 0; i < svgCount; i++) {
          const hidden     = await svgs.nth(i).getAttribute('aria-hidden');
          const titleCount = await svgs.nth(i).locator('title').count();
          expect(
            hidden === 'true' || titleCount > 0,
            `svg[${i}] must have aria-hidden="true" or a <title> element`
          ).toBe(true);
        }
      }

      // iframe — title attribute presence (WCAG 4.1.2)
      if (htmlElements.includes('iframe')) {
        const iframes     = block.locator('iframe');
        const iframeCount = await iframes.count();
        for (let i = 0; i < iframeCount; i++) {
          const iframeTitle = await iframes.nth(i).getAttribute('title');
          expect(iframeTitle?.trim(), `iframe[${i}] must have a title attribute`).toBeTruthy();
        }
      }

      // video/audio — track element presence (WCAG 1.2)
      if (htmlElements.includes('video') || htmlElements.includes('audio')) {
        const mediaEls   = block.locator('video, audio');
        const mediaCount = await mediaEls.count();
        for (let i = 0; i < mediaCount; i++) {
          const trackCount = await mediaEls.nth(i).locator('track').count();
          expect(
            trackCount,
            `media element [${i}] must have at least one <track> for captions (WCAG 1.2)`
          ).toBeGreaterThan(0);
        }
      }

      // dialog — trigger button existence
      if (htmlElements.includes('dialog')) {
        const dialogEls   = block.locator('dialog');
        const dialogCount = await dialogEls.count();
        if (dialogCount > 0) {
          const triggerCount = await block.locator('button, [role="button"]').count();
          expect(
            triggerCount,
            'dialog block must have at least one trigger button'
          ).toBeGreaterThan(0);
        }
      }

      // aria-* attributes — non-empty value assertions
      for (const attr of ariaAttributes) {
        const attrEls   = block.locator(`[${attr}]`);
        const attrCount = await attrEls.count();
        for (let i = 0; i < attrCount; i++) {
          const val = await attrEls.nth(i).getAttribute(attr);
          expect(val, `[${attr}] element [${i}] must have a value`).not.toBeNull();
        }
      }

      // Attribute value assertions from render.php cross-reference
      for (const { key, value } of contentAssertions) {
        expect(rendered, `${key} value should appear in rendered output`).toContain(value);
      }

      // wp-interactivity — data-wp-* directive presence
      if (hasInteractiveDirectives) {
        const interactiveEl = block.locator(
          '[data-wp-interactive], [data-wp-bind], [data-wp-on], [data-wp-class], [data-wp-context]'
        ).first();
        await expect(interactiveEl).toBeVisible();
      }
    });

    test('rendered HTML is valid markup — wrapper is present in parsed DOM', async ({ page, requestUtils }: any) => {
      test.setTimeout(10_000);
      const rendered = await fetchAndRenderBlock(page, requestUtils, config);
      if (rendered === null) { test.skip(); return; }
      await expect(page.locator(`.${wrapperClass}`)).toBeAttached();
    });

    // -----------------------------------------------------------------------
    // Accessibility
    // -----------------------------------------------------------------------

    test('rendered HTML passes axe WCAG 2.2 AA scan', async ({ page, requestUtils }: any) => {
      test.setTimeout(20_000);
      const rendered = await fetchAndRenderBlock(page, requestUtils, config);
      if (rendered === null) { test.skip(); return; }

      const results = await new AxeBuilder({ page })
        .include(`.${wrapperClass}`)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();

      logAxeViolations(title, results.violations);
      expect(results.violations).toEqual([]);
    });

    test('rendered HTML passes colour contrast check', async ({ page, requestUtils }: any) => {
      test.setTimeout(20_000);
      const rendered = await fetchAndRenderBlock(page, requestUtils, config);
      if (rendered === null) { test.skip(); return; }

      const results = await new AxeBuilder({ page })
        .include(`.${wrapperClass}`)
        .withRules(['color-contrast'])
        .analyze();

      logAxeViolations(`${title} (contrast)`, results.violations);
      expect(results.violations).toEqual([]);
    });

    test('rendered HTML has no ARIA violations', async ({ page, requestUtils }: any) => {
      test.setTimeout(15_000);
      const rendered = await fetchAndRenderBlock(page, requestUtils, config);
      if (rendered === null) { test.skip(); return; }

      const results = await new AxeBuilder({ page })
        .include(`.${wrapperClass}`)
        .withRules([
          'aria-allowed-attr',
          'aria-required-attr',
          'aria-required-children',
          'aria-required-parent',
          'aria-roles',
          'aria-valid-attr',
          'aria-valid-attr-value',
        ])
        .analyze();

      logAxeViolations(`${title} (ARIA)`, results.violations);
      expect(results.violations).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // Interactive block tests
    // -----------------------------------------------------------------------

    if (hasInteractiveDirectives) {
      test('interactive block passes axe scan after hydration', async ({ page, requestUtils }: any) => {
        test.setTimeout(20_000);
        const rendered = await fetchAndRenderBlock(page, requestUtils, config);
        if (rendered === null) { test.skip(); return; }

        // Wait for wp-interactivity to hydrate
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(300);

        const results = await new AxeBuilder({ page })
          .include(`.${wrapperClass}`)
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();

        logAxeViolations(`${title} (after hydration)`, results.violations);
        expect(results.violations).toEqual([]);
      });

      test('interactive elements are keyboard accessible', async ({ page, requestUtils }: any) => {
        test.setTimeout(20_000);
        const rendered = await fetchAndRenderBlock(page, requestUtils, config);
        if (rendered === null) { test.skip(); return; }

        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(300);

        const interactiveEls = page.locator(
          `.${wrapperClass} button, .${wrapperClass} a, .${wrapperClass} input, .${wrapperClass} select, .${wrapperClass} [tabindex]`
        );
        const count = await interactiveEls.count();

        for (let i = 0; i < count; i++) {
          const tabIndex = await interactiveEls.nth(i).getAttribute('tabindex');
          expect(
            tabIndex === null || tabIndex === '0' || tabIndex === '-1' || parseInt(tabIndex) > 0,
            `Interactive element [${i}] has unexpected tabindex: "${tabIndex}"`
          ).toBe(true);
        }
      });
    }

    // -----------------------------------------------------------------------
    // Visual regression
    // -----------------------------------------------------------------------

    if (visualRegression) {
      test('block visual appearance matches baseline screenshot', async ({ page, requestUtils }: any) => {
        test.setTimeout(20_000);
        const rendered = await fetchAndRenderBlock(page, requestUtils, config);
        if (rendered === null) { test.skip(); return; }

        // toHaveScreenshot() creates a baseline PNG on first run and compares
        // on subsequent runs. Update after an intentional visual change:
        //   npx playwright test --project=all-blocks-frontend --update-snapshots
        await expect(
          page.locator(`.${wrapperClass}`)
        ).toHaveScreenshot(`${wrapperClass}.png`, {
          maxDiffPixelRatio: 0.02,
          animations:        'disabled',
        });
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Discovery-based registration
// ---------------------------------------------------------------------------

/**
 * Reads `wp-env-bin.e2e.config.json`, loads each block.json listed under
 * `"frontend"`, and registers the full front-end test suite for each block.
 * Block CSS is read from disk and render.php is analysed at test startup —
 * no spec file regeneration required when block.json or CSS changes.
 *
 * @param test       - The test instance from @wordpress/e2e-test-utils-playwright
 * @param configPath - Absolute path to wp-env-bin.e2e.config.json.
 *                     Use path.join(__dirname, '../../wp-env-bin.e2e.config.json')
 *                     from within a spec file.
 * @param options    - { screenshots?, visualRegression? }
 *
 * @example
 * // specs/frontend/blocks.spec.ts
 * import { test } from '@wordpress/e2e-test-utils-playwright';
 * import { registerFrontendTestsFromConfig } from '@e2e/utils/frontend-tests';
 * import * as path from 'path';
 * registerFrontendTestsFromConfig(test, path.join(__dirname, '../../wp-env-bin.e2e.config.json'), { screenshots: true });
 */
export function registerFrontendTestsFromConfig(
  test:       any,
  configPath: string,
  options:    FrontendLoadOptions = {},
): void {
  const fs   = require('fs');
  const path = require('path');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `[wp-env-bin] Config file not found: ${configPath}\n` +
      'Run "wp-env-bin e2e scaffold" to create it, then add block directories to the "frontend" array.'
    );
  }

  const cfg: { frontend?: string[] } = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const root = path.resolve(path.dirname(configPath), '../..');

  for (const dir of (cfg.frontend ?? [])) {
    const blockJsonPath = path.resolve(root, dir, 'block.json');
    if (!fs.existsSync(blockJsonPath)) {
      console.warn(`[wp-env-bin] block.json not found at ${blockJsonPath} — skipping`);
      continue;
    }
    registerFrontendTests(test, loadFrontendConfig(blockJsonPath, options));
  }
}
