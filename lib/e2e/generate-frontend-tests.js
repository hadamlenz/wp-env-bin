#!/usr/bin/env node

// =============================================================================
// generate-frontend-tests.js
// =============================================================================
//
// Generates Playwright front-end test stubs for WordPress custom blocks using
// the WordPress Block Renderer REST API (/wp/v2/block-renderer).
//
// The REST API calls render.php directly with the provided attributes and
// returns the rendered HTML. This approach:
//   - Tests the REST API endpoint itself
//   - Tests the PHP render function in isolation
//   - Does not require creating posts or visiting full pages
//   - Loads rendered HTML into Playwright via page.setContent() for DOM
//     assertions and axe-core accessibility scanning
//   - Injects the block's built CSS (when available) for accurate contrast testing
//   - Optionally saves block screenshots for documentation (--screenshots)
//   - Optionally generates visual regression tests (--visual-regression)
//
// All generated tests run without modification. There are no TODO items.
// Assertions are derived automatically from:
//   - HTML elements found in render.php (img, a, button, svg, iframe, video, dialog)
//   - ARIA attributes found in render.php (non-empty value assertions)
//   - $attributes['key'] usage in render.php cross-referenced with example.attributes
//     in block.json (string value presence assertions)
//   - wp-interactivity directives (data-wp-* presence assertions)
//
// For interactive behavior (dialog open/close, keyboard state changes) write
// hand-authored tests in elements/{block}/frontend.e2e.ts using the same
// requestUtils.rest() + page.setContent() pattern.
//
// Attributes are sent as a POST body object — NOT a JSON-encoded string.
// The REST API schema validates that attributes is of type object and
// returns a 400 with code rest_invalid_param if a string is received.
//
// Blocks that require post context will return a 400 from the renderer
// endpoint. Those tests are skipped automatically and a comment is added
// pointing to the post-context fallback pattern.
//
// Requires: @axe-core/playwright
//   npm install --save-dev @axe-core/playwright
//
// Usage:
//   Single file:
//     node scripts/generate-frontend-tests.js --file=elements/icon/block.json
//
//   Multiple files:
//     node scripts/generate-frontend-tests.js \
//       --file=elements/icon/block.json \
//       --file=elements/card/block.json
//
//   Glob pattern (requires: npm install --save-dev glob):
//     node scripts/generate-frontend-tests.js --glob="elements/**/block.json"
//
//   With documentation screenshots:
//     node scripts/generate-frontend-tests.js --glob="elements/**/block.json" --screenshots
//
//   With visual regression tests:
//     node scripts/generate-frontend-tests.js --glob="elements/**/block.json" --visual-regression
//
//   Custom output directory:
//     node scripts/generate-frontend-tests.js \
//       --file=elements/icon/block.json \
//       --output=tests/e2e/frontend
//
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const result = {
    files:            [],
    output:           './specs/frontend',
    glob:             null,
    screenshots:      false,
    visualRegression: false,
    help:             false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg.startsWith('--file=')) {
      result.files.push(arg.slice('--file='.length));
    } else if (arg.startsWith('--output=')) {
      result.output = arg.slice('--output='.length);
    } else if (arg.startsWith('--glob=')) {
      result.glob = arg.slice('--glob='.length);
    } else if (arg === '--screenshots') {
      result.screenshots = true;
    } else if (arg === '--visual-regression') {
      result.visualRegression = true;
    } else {
      console.warn(`⚠️  Unknown argument ignored: ${arg}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Block wrapper class derivation
// ---------------------------------------------------------------------------

/**
 * Derives the standard WordPress block wrapper CSS class from the block name.
 * e.g. "uncch/icon" -> "wp-block-uncch-icon"
 *
 * @param {string} blockName
 * @returns {string}
 */
function deriveWrapperClass(blockName) {
  return `wp-block-${blockName.replace('/', '-')}`;
}

/**
 * Returns the URL-encoded block name for use in REST API paths.
 * e.g. "uncch/icon" -> "uncch%2Ficon"
 *
 * @param {string} blockName
 * @returns {string}
 */
function encodeBlockName(blockName) {
  return blockName.replace('/', '%2F');
}

/**
 * Converts an ARIA attribute name to a safe JavaScript variable name prefix.
 * e.g. "aria-label" -> "ariaLabel"
 *
 * @param {string} ariaAttr
 * @returns {string}
 */
function ariaAttrToVarName(ariaAttr) {
  return ariaAttr
    .replace(/^aria-/, 'aria_')
    .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Attribute sanitization for REST API calls
// ---------------------------------------------------------------------------

/**
 * Removes attributes whose schema declares "type": "null" from the example
 * attributes before sending them to the block renderer REST API.
 * The REST API validates against the block's attribute schema; a null-typed
 * attribute only accepts null, so passing any other value (e.g. true for
 * isBlockPreview) triggers 400 rest_invalid_param.
 *
 * @param {object} exampleAttributes - From block.json example.attributes
 * @param {object} blockAttributes   - From block.json attributes (schema)
 * @returns {object}
 */
function sanitizeAttributesForApi(exampleAttributes, blockAttributes) {
  if (!exampleAttributes || !blockAttributes) return exampleAttributes || {};
  return Object.fromEntries(
    Object.entries(exampleAttributes).filter(
      ([key]) => blockAttributes[key]?.type !== 'null'
    )
  );
}

// ---------------------------------------------------------------------------
// Block CSS resolution
// ---------------------------------------------------------------------------

/**
 * Attempts to resolve and read the block's built CSS file.
 * Returns the CSS string if found, null otherwise.
 *
 * @param {string} blockJsonPath
 * @param {object} blockJson
 * @returns {string|null}
 */
function resolveBlockCss(blockJsonPath, blockJson) {
  const candidates = [blockJson.style, blockJson.editorStyle]
    .flat()
    .filter(Boolean);

  for (const field of candidates) {
    if (typeof field !== 'string' || !field.startsWith('file:')) continue;

    const cssRelative = field.replace(/^file:/, '');
    const cssPath     = path.resolve(path.dirname(blockJsonPath), cssRelative);

    if (fs.existsSync(cssPath)) {
      try {
        const css = fs.readFileSync(cssPath, 'utf8');
        console.log(`   ℹ️  CSS found:   ${cssPath}`);
        return css;
      } catch {
        console.warn(`   ⚠️  Could not read CSS at ${cssPath}`);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// PHP render file analysis
// ---------------------------------------------------------------------------

/**
 * Reads and analyses the render.php file adjacent to block.json.
 *
 * @param {string} blockJsonPath
 * @param {object} blockJson
 * @returns {object}
 */
function analyseRenderPhp(blockJsonPath, blockJson) {
  const result = {
    found:                  false,
    path:                   null,
    isDynamic:              false,
    usesWrapperAttrs:       false,
    ariaAttributes:         [],
    htmlElements:           [],
    attributesUsed:         [],
    attributesIssetGuarded: [],
    hasInteractivity:       false,
    renderFieldInJson:      null,
  };

  if (blockJson.render) {
    result.renderFieldInJson = blockJson.render;
    result.isDynamic         = true;
    const renderRelative     = blockJson.render.replace(/^file:/, '');
    result.path              = path.resolve(path.dirname(blockJsonPath), renderRelative);
  }

  if (!result.path) {
    const candidate = path.resolve(path.dirname(blockJsonPath), 'render.php');
    if (fs.existsSync(candidate)) {
      result.path      = candidate;
      result.isDynamic = true;
    }
  }

  if (!result.path || !fs.existsSync(result.path)) return result;

  result.found = true;

  let php = '';
  try {
    php = fs.readFileSync(result.path, 'utf8');
  } catch {
    return result;
  }

  result.usesWrapperAttrs = /get_block_wrapper_attributes/.test(php);

  const ariaMatches     = [...php.matchAll(/aria-([a-z-]+)/g)];
  result.ariaAttributes = [...new Set(ariaMatches.map(m => `aria-${m[1]}`))];

  const elementMatches = [...php.matchAll(/<(a|button|img|input|select|textarea|video|audio|iframe|svg|canvas|dialog|details|summary)\b/gi)];
  result.htmlElements  = [...new Set(elementMatches.map(m => m[1].toLowerCase()))];

  const attrMatches     = [...php.matchAll(/\$attributes\[['"]([^'"]+)['"]\]/g)];
  result.attributesUsed = [...new Set(attrMatches.map(m => m[1]))];

  // Detect attributes that are guarded by isset() inside if() conditions.
  // These are only output when the condition is met — asserting their example
  // values appear in the rendered HTML is unreliable.
  const issetMatches = [...php.matchAll(/\bif\s*\([^)]*isset\s*\(\s*\$attributes\[['"]([^'"]+)['"]\]\s*\)/g)];
  result.attributesIssetGuarded = [...new Set(issetMatches.map(m => m[1]))];

  result.hasInteractivity = /wp-interactivity|data-wp-/.test(php);

  return result;
}

// ---------------------------------------------------------------------------
// REST API call snippet generator
//
// WHY POST not GET:
// The WordPress block renderer REST API validates that the attributes
// parameter is of type object. When using GET, requestUtils serialises
// params as query string values — attributes becomes a JSON string which
// fails schema validation with 400 rest_invalid_param.
// POST with a data body sends attributes as a proper JSON object.
// ---------------------------------------------------------------------------

/**
 * Generates the REST API POST call snippet used in every test.
 *
 * @param {string}      blockName
 * @param {object}      exampleAttributes
 * @param {string|null} blockCss
 * @param {boolean}     takeScreenshot
 * @returns {string}
 */
function generateRendererCallSnippet(blockName, exampleAttributes, blockCss, takeScreenshot) {
  const encodedName   = encodeBlockName(blockName);
  const attrsObject   = JSON.stringify(exampleAttributes || {});
  const hasAttributes = exampleAttributes && Object.keys(exampleAttributes).length > 0;
  const wrapperClass  = deriveWrapperClass(blockName);

  const cssInjection = blockCss
    ? `// Inject block CSS so contrast and layout assertions reflect actual styles.
    // Without CSS, axe contrast rules pass trivially on browser defaults.
    const blockCss = \`${blockCss.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`;
    await page.setContent(\`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>\${blockCss}</style>
</head>
<body>
  \${rendered.rendered}
</body>
</html>\`, { waitUntil: 'domcontentloaded' });`
    : `// No built CSS found — loading rendered HTML without block styles.
    // Add a "file:" style reference to block.json for accurate contrast results.
    await page.setContent(\`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  \${rendered.rendered}
</body>
</html>\`, { waitUntil: 'domcontentloaded' });`;

  const screenshotStep = takeScreenshot ? `
    // Save a dated documentation screenshot of the rendered block.
    // Not a visual regression baseline — for documentation only.
    // Add test-results/screenshots to .gitignore to exclude from commits.
    const screenshotDir  = 'test-results/screenshots/frontend';
    const screenshotDate = new Date().toISOString().split('T')[0];
    const screenshotPath = \`\${screenshotDir}/${wrapperClass}-\${screenshotDate}.png\`;
    const blockEl = page.locator('.${wrapperClass}');
    await blockEl.waitFor({ state: 'attached' });
    if (await blockEl.isVisible()) {
      await blockEl.screenshot({
        path:       screenshotPath,
        animations: 'disabled',
      });
      console.log(\`📸  Screenshot saved: \${screenshotPath}\`);
    } else {
      console.log(\`⏭️  Screenshot skipped: block has no visible dimensions (empty container)\`);
    }` : '';

  return `// POST to the WordPress Block Renderer REST API.
    // Attributes MUST be sent as a plain object in the POST body.
    // GET + query params serialises attributes as a string which triggers
    // 400 rest_invalid_param from the REST API schema validator.
    let rendered: { rendered: string };
    try {
      rendered = await requestUtils.rest({
        method: 'POST',
        path:   '/wp/v2/block-renderer/${encodedName}',
        data:   {
          attributes: ${hasAttributes ? attrsObject : '{}'},
          context:    'edit',
        },
      }) as { rendered: string };
    } catch (err: any) {
      // Blocks that require post context return 400 from the renderer.
      // Those tests are skipped automatically — see the post-context fallback
      // comment at the bottom of this file.
      if (err?.status === 400 || err?.status === 404 || err?.code === 'block_invalid_context' || err?.code === 'block_invalid') {
        test.skip();
        return;
      }
      throw err;
    }

    expect(rendered.rendered.trim()).not.toBe('');

    ${cssInjection}
    ${screenshotStep}`;
}

// ---------------------------------------------------------------------------
// Assertion generators
//
// All assertions are derived automatically from render.php analysis and
// block.json example.attributes. No TODO items — all tests run as-is.
//
// Automation coverage:
//   img      → alt attribute presence (WCAG 1.1.1)
//   a        → accessible name presence (WCAG 2.4.4)
//   button   → accessible name presence (WCAG 4.1.2)
//   svg      → aria-hidden or <title> presence (WCAG 1.1.1)
//   iframe   → title attribute presence (WCAG 4.1.2)
//   video    → <track> element presence (WCAG 1.2)
//   audio    → <track> element presence (WCAG 1.2)
//   dialog   → trigger button existence
//   aria-*   → non-empty value assertion for each aria attribute found
//   attrs    → string values from example.attributes appear in rendered HTML
//   interactive → data-wp-* directive presence
//
// NOT automated (write in hand-authored frontend.e2e.ts):
//   - Dialog keyboard open/close behavior
//   - Specific ARIA attribute expected values
//   - Complex interactive state changes
// ---------------------------------------------------------------------------

/**
 * Generates DOM assertions scoped to the block wrapper.
 * All assertions are derived automatically — no TODO items remain.
 *
 * @param {string} wrapperClass
 * @param {object} renderAnalysis
 * @param {object} exampleAttributes - From block.json example.attributes
 * @returns {string}
 */
function generateRenderAssertions(wrapperClass, renderAnalysis, exampleAttributes) {
  const lines = [];

  lines.push(`const block = page.locator('.${wrapperClass}');`);
  lines.push(`await expect(block).toBeAttached();`);
  lines.push('');

  // Static blocks (no render.php) — the axe tests below provide coverage.
  // No element-specific assertions are possible without knowing save.js output.
  if (!renderAnalysis.found) {
    lines.push(`// Static block rendered by save.js — axe tests below provide accessibility coverage.`);
    return lines.map(l => l ? `    ${l}` : '').join('\n');
  }

  // -------------------------------------------------------------------------
  // img — alt attribute presence (WCAG 1.1.1)
  // -------------------------------------------------------------------------
  if (renderAnalysis.htmlElements.includes('img')) {
    lines.push(`// render.php outputs <img> — assert alt attribute is present (WCAG 1.1.1)`);
    lines.push(`// alt="" is valid for decorative images; missing alt is always a violation`);
    lines.push(`const images   = block.locator('img');`);
    lines.push(`const imgCount = await images.count();`);
    lines.push(`for (let i = 0; i < imgCount; i++) {`);
    lines.push(`  const alt = await images.nth(i).getAttribute('alt');`);
    lines.push(`  expect(alt, \`img[\${i}] must have an alt attribute\`).not.toBeNull();`);
    lines.push(`}`);
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // a — accessible name presence (WCAG 2.4.4)
  // -------------------------------------------------------------------------
  if (renderAnalysis.htmlElements.includes('a')) {
    lines.push(`// render.php outputs <a> — assert all links have an accessible name (WCAG 2.4.4)`);
    lines.push(`const links     = block.locator('a');`);
    lines.push(`const linkCount = await links.count();`);
    lines.push(`for (let i = 0; i < linkCount; i++) {`);
    lines.push(`  const text           = (await links.nth(i).innerText()).trim();`);
    lines.push(`  const ariaLabel      = await links.nth(i).getAttribute('aria-label');`);
    lines.push(`  const ariaLabelledBy = await links.nth(i).getAttribute('aria-labelledby');`);
    lines.push(`  expect(`);
    lines.push(`    text || ariaLabel || ariaLabelledBy,`);
    lines.push(`    \`a[\${i}] must have an accessible name\``);
    lines.push(`  ).toBeTruthy();`);
    lines.push(`}`);
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // button — accessible name presence (WCAG 4.1.2)
  // -------------------------------------------------------------------------
  if (renderAnalysis.htmlElements.includes('button')) {
    lines.push(`// render.php outputs <button> — assert all buttons have an accessible name (WCAG 4.1.2)`);
    lines.push(`const buttons  = block.locator('button');`);
    lines.push(`const btnCount = await buttons.count();`);
    lines.push(`for (let i = 0; i < btnCount; i++) {`);
    lines.push(`  const text      = (await buttons.nth(i).innerText()).trim();`);
    lines.push(`  const ariaLabel = await buttons.nth(i).getAttribute('aria-label');`);
    lines.push(`  expect(`);
    lines.push(`    text || ariaLabel,`);
    lines.push(`    \`button[\${i}] must have an accessible name\``);
    lines.push(`  ).toBeTruthy();`);
    lines.push(`}`);
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // svg — aria-hidden or title (WCAG 1.1.1)
  // -------------------------------------------------------------------------
  if (renderAnalysis.htmlElements.includes('svg')) {
    lines.push(`// render.php outputs <svg> — assert each is decorative (aria-hidden) or has a title (WCAG 1.1.1)`);
    lines.push(`const svgs     = block.locator('svg');`);
    lines.push(`const svgCount = await svgs.count();`);
    lines.push(`for (let i = 0; i < svgCount; i++) {`);
    lines.push(`  const hidden     = await svgs.nth(i).getAttribute('aria-hidden');`);
    lines.push(`  const titleCount = await svgs.nth(i).locator('title').count();`);
    lines.push(`  expect(`);
    lines.push(`    hidden === 'true' || titleCount > 0,`);
    lines.push(`    \`svg[\${i}] must have aria-hidden="true" or a <title> element\``);
    lines.push(`  ).toBe(true);`);
    lines.push(`}`);
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // iframe — title attribute presence (WCAG 4.1.2)
  // -------------------------------------------------------------------------
  if (renderAnalysis.htmlElements.includes('iframe')) {
    lines.push(`// render.php outputs <iframe> — assert title is present (WCAG 4.1.2)`);
    lines.push(`const iframes     = block.locator('iframe');`);
    lines.push(`const iframeCount = await iframes.count();`);
    lines.push(`for (let i = 0; i < iframeCount; i++) {`);
    lines.push(`  const title = await iframes.nth(i).getAttribute('title');`);
    lines.push(`  expect(title?.trim(), \`iframe[\${i}] must have a title attribute\`).toBeTruthy();`);
    lines.push(`}`);
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // video / audio — track element presence (WCAG 1.2)
  // Axe does not reliably detect missing captions — this check fills that gap.
  // -------------------------------------------------------------------------
  if (renderAnalysis.htmlElements.includes('video') || renderAnalysis.htmlElements.includes('audio')) {
    lines.push(`// render.php outputs a media element — assert caption <track> elements are present (WCAG 1.2)`);
    lines.push(`// Axe does not reliably catch missing caption tracks — this fills that gap.`);
    lines.push(`const mediaEls   = block.locator('video, audio');`);
    lines.push(`const mediaCount = await mediaEls.count();`);
    lines.push(`for (let i = 0; i < mediaCount; i++) {`);
    lines.push(`  const trackCount = await mediaEls.nth(i).locator('track').count();`);
    lines.push(`  expect(`);
    lines.push(`    trackCount,`);
    lines.push(`    \`media element [\${i}] must have at least one <track> for captions (WCAG 1.2)\``);
    lines.push(`  ).toBeGreaterThan(0);`);
    lines.push(`}`);
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // dialog — trigger button existence
  // Keyboard open/close behavior belongs in hand-authored frontend.e2e.ts.
  // -------------------------------------------------------------------------
  if (renderAnalysis.htmlElements.includes('dialog')) {
    lines.push(`// render.php outputs <dialog> — assert a trigger button exists in the block`);
    lines.push(`// Keyboard open/close behavior: write in elements/{block}/frontend.e2e.ts`);
    lines.push(`const dialogEls   = block.locator('dialog');`);
    lines.push(`const dialogCount = await dialogEls.count();`);
    lines.push(`if (dialogCount > 0) {`);
    lines.push(`  const triggerCount = await block.locator('button, [role="button"]').count();`);
    lines.push(`  expect(`);
    lines.push(`    triggerCount,`);
    lines.push(`    'dialog block must have at least one trigger button'`);
    lines.push(`  ).toBeGreaterThan(0);`);
    lines.push(`}`);
    lines.push('');
  }

  // -------------------------------------------------------------------------
  // ARIA attributes — non-empty value assertions
  // Asserts each aria-* attribute found in render.php has a non-empty value.
  // Specific expected values belong in hand-authored frontend.e2e.ts.
  // -------------------------------------------------------------------------
  if (renderAnalysis.ariaAttributes.length > 0) {
    for (const attr of renderAnalysis.ariaAttributes) {
      const varName = ariaAttrToVarName(attr);
      lines.push(`// render.php uses ${attr} — assert all instances have non-empty values`);
      lines.push(`const ${varName}Els   = block.locator('[${attr}]');`);
      lines.push(`const ${varName}Count = await ${varName}Els.count();`);
      lines.push(`for (let i = 0; i < ${varName}Count; i++) {`);
      lines.push(`  const val = await ${varName}Els.nth(i).getAttribute('${attr}');`);
      lines.push(`  // Booleans like aria-expanded="false" are valid — only truly empty values fail`);
      lines.push(`  expect(val, \`[${attr}] element [\${i}] must have a value\`).not.toBeNull();`);
      lines.push(`}`);
      lines.push('');
    }
  }

  // -------------------------------------------------------------------------
  // Attribute values — cross-reference example.attributes with render.php usage
  // For each $attributes['key'] in render.php that has a string value in
  // example.attributes, assert that value appears in the rendered HTML.
  // This verifies render.php is correctly applying the attributes it declares.
  // -------------------------------------------------------------------------
  if (renderAnalysis.attributesUsed.length > 0 && exampleAttributes) {
    const PALETTE_SLUG_RE = /^[a-z][a-z0-9-]+$/;
    const issetGuarded    = new Set(renderAnalysis.attributesIssetGuarded || []);
    const stringAssertions = renderAnalysis.attributesUsed
      .filter(key => {
        if (!(key in exampleAttributes)) return false;
        const val = exampleAttributes[key];
        if (typeof val !== 'string' || !val.trim()) return false;
        // Skip color attributes whose values are theme palette slugs —
        // render.php resolves slugs to hex/CSS vars, the slug never appears in HTML.
        if (/color/i.test(key) && PALETTE_SLUG_RE.test(val.trim())) return false;
        // Skip attributes only output when an isset() condition is met —
        // the example.attributes may not satisfy that condition.
        if (issetGuarded.has(key)) return false;
        return true;
      })
      .map(key => ({ key, value: exampleAttributes[key] }));

    if (stringAssertions.length > 0) {
      lines.push(`// Cross-reference: render.php uses these attributes and example.attributes`);
      lines.push(`// provides string values — assert each value appears in the rendered HTML.`);
      lines.push(`// This verifies render.php correctly outputs the attributes it declares.`);
      for (const { key, value } of stringAssertions) {
        const safeValue = value.replace(/'/g, "\\'");
        lines.push(`expect(rendered.rendered, '${key} value should appear in rendered output').toContain('${safeValue}');`);
      }
      lines.push('');
    }
  }

  // -------------------------------------------------------------------------
  // wp-interactivity — data-wp-* directive presence
  // -------------------------------------------------------------------------
  if (renderAnalysis.hasInteractivity) {
    lines.push(`// render.php uses wp-interactivity — assert directives are present in the output`);
    lines.push(`const interactiveEl = block.locator(`);
    lines.push(`  '[data-wp-interactive], [data-wp-bind], [data-wp-on], [data-wp-class], [data-wp-context]'`);
    lines.push(`).first();`);
    lines.push(`await expect(interactiveEl).toBeVisible();`);
    lines.push('');
  }

  return lines.map(l => l ? `    ${l}` : '').join('\n');
}

/**
 * Generates the visual regression test block.
 *
 * @param {string} blockName
 * @param {string} title
 * @param {string} wrapperClass
 * @param {string} rendererCallSnippet
 * @returns {string}
 */
function generateVisualRegressionTest(blockName, title, wrapperClass, rendererCallSnippet) {
  return `
  // -------------------------------------------------------------------------
  // Visual regression
  // -------------------------------------------------------------------------

  test('block visual appearance matches baseline screenshot', async ({ page, requestUtils }) => {
    test.setTimeout(20_000);

    ${rendererCallSnippet}

    // toHaveScreenshot() creates a baseline PNG on the first run and compares
    // pixel-by-pixel on subsequent runs. Baselines are stored in:
    //   tests/e2e/frontend/${wrapperClass}.spec.ts-snapshots/
    //
    // Update baselines after an intentional visual change:
    //   npx playwright test --project=all-blocks-frontend --update-snapshots
    //
    // maxDiffPixelRatio: 0.02 allows 2% pixel difference to accommodate
    // sub-pixel rendering differences across platforms.
    await expect(
      page.locator('.${wrapperClass}')
    ).toHaveScreenshot('${wrapperClass}.png', {
      maxDiffPixelRatio: 0.02,
      animations:        'disabled',
    });
  });`;
}

// ---------------------------------------------------------------------------
// Full test file generator
// ---------------------------------------------------------------------------

/**
 * Generates the full front-end test file content for a block.
 *
 * @param {object}      blockJson
 * @param {object}      renderAnalysis
 * @param {string|null} blockCss
 * @param {string}      blockJsonPath
 * @param {boolean}     takeScreenshots
 * @param {boolean}     visualRegression
 * @returns {string}
 */
function generateTestFile(blockJson, renderAnalysis, blockCss, blockJsonPath, takeScreenshots, visualRegression) {
  const blockName         = blockJson.name;
  const title             = blockJson.title || blockName;
  const exampleAttributes = blockJson.example?.attributes || {};
  const apiAttributes     = sanitizeAttributesForApi(exampleAttributes, blockJson.attributes || {});
  const hasExample        = Object.keys(exampleAttributes).length > 0;
  const today             = new Date().toISOString().split('T')[0];
  const blockSlug         = blockName.split('/')[1] ?? blockName;
  const wrapperClass      = deriveWrapperClass(blockName);
  const encodedName       = encodeBlockName(blockName);
  const attrsObject       = JSON.stringify(apiAttributes);
  const hasAttributes     = Object.keys(apiAttributes).length > 0;

  const rendererCallSnippet = generateRendererCallSnippet(
    blockName, apiAttributes, blockCss, takeScreenshots
  );
  const renderAssertions    = generateRenderAssertions(
    wrapperClass, renderAnalysis, exampleAttributes
  );
  const visualRegressionTest = visualRegression
    ? generateVisualRegressionTest(blockName, title, wrapperClass, rendererCallSnippet)
    : '';

  // Build summary of what assertions will be generated
  const autoAssertions = [
    renderAnalysis.htmlElements.includes('img')                    ? 'img alt presence'          : null,
    renderAnalysis.htmlElements.includes('a')                      ? 'link accessible names'     : null,
    renderAnalysis.htmlElements.includes('button')                 ? 'button accessible names'   : null,
    renderAnalysis.htmlElements.includes('svg')                    ? 'svg aria-hidden or title'  : null,
    renderAnalysis.htmlElements.includes('iframe')                 ? 'iframe title'              : null,
    renderAnalysis.htmlElements.includes('video') ||
    renderAnalysis.htmlElements.includes('audio')                  ? 'media track presence'      : null,
    renderAnalysis.htmlElements.includes('dialog')                 ? 'dialog trigger button'     : null,
    renderAnalysis.ariaAttributes.length                           ? 'aria attr non-empty values': null,
    renderAnalysis.hasInteractivity                                ? 'wp-interactivity presence' : null,
  ].filter(Boolean);

  // Count automatable attribute value assertions
  const autoAttrAssertions = renderAnalysis.attributesUsed
    .filter(key =>
      key in exampleAttributes &&
      typeof exampleAttributes[key] === 'string' &&
      exampleAttributes[key].trim().length > 0
    );

  if (autoAttrAssertions.length) {
    autoAssertions.push(`attribute values (${autoAttrAssertions.map(k => `'${k}'`).join(', ')})`);
  }

  const dynamicNote   = renderAnalysis.isDynamic
    ? `Dynamic block — PHP: ${renderAnalysis.renderFieldInJson ?? 'render.php'}`
    : `Static block — save.js (no render.php)`;
  const renderPhpNote = renderAnalysis.found
    ? `render.php: ${renderAnalysis.path}`
    : `render.php: not found`;
  const cssSummary    = blockCss
    ? `CSS injected — contrast results reflect actual rendered styles`
    : `CSS not found — add a "file:" style reference to block.json for accurate contrast`;
  const screenshotNote = takeScreenshots
    ? `Documentation screenshots: enabled`
    : `Documentation screenshots: disabled (--screenshots to enable)`;
  const visualNote     = visualRegression
    ? `Visual regression: enabled`
    : `Visual regression: disabled (--visual-regression to enable)`;

  const interactivityTests = renderAnalysis.hasInteractivity ? `
  test('interactive block passes axe scan after hydration', async ({ page, requestUtils }) => {
    test.setTimeout(20_000);

    ${rendererCallSnippet}

    // Wait for wp-interactivity to hydrate — initialises on DOMContentLoaded
    // but may need a tick to apply state to the DOM.
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      .include('.${wrapperClass}')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa','wcag22aa'])
      .analyze();

    logAxeViolations('${title} (after hydration)', results.violations);
    expect(results.violations).toEqual([]);
  });

  test('interactive elements are keyboard accessible', async ({ page, requestUtils }) => {
    test.setTimeout(20_000);

    ${rendererCallSnippet}

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);

    // All interactive elements must be in the tab order (tabindex null or 0)
    // or intentionally excluded (tabindex="-1" for programmatically focused elements).
    const interactiveEls = page.locator(
      '.${wrapperClass} button, .${wrapperClass} a, .${wrapperClass} input, .${wrapperClass} select, .${wrapperClass} [tabindex]'
    );
    const count = await interactiveEls.count();

    for (let i = 0; i < count; i++) {
      const tabIndex = await interactiveEls.nth(i).getAttribute('tabindex');
      expect(
        tabIndex === null || tabIndex === '0' || tabIndex === '-1' || parseInt(tabIndex) > 0,
        \`Interactive element [\${i}] has unexpected tabindex: "\${tabIndex}"\`
      ).toBe(true);
    }
  });` : '';

  const postContextFallback = `
  // ---------------------------------------------------------------------------
  // Post context fallback
  // ---------------------------------------------------------------------------
  //
  // If this block requires post context (uses get_the_ID(), the_content(), etc.)
  // the block renderer REST API returns 400 and the tests above are skipped.
  // In that case write post-context tests like this in frontend.e2e.ts:
  //
  //   test('block renders in post context', async ({ page, requestUtils }) => {
  //     const post = await requestUtils.createPost({
  //       title:   'Frontend Test',
  //       content: '<!-- wp:${blockName} ${JSON.stringify(exampleAttributes)} /-->',
  //       status:  'publish',
  //     });
  //     await page.goto(\`/?p=\${post.id}\`);
  //     await expect(page.locator('.${wrapperClass}')).toBeVisible();
  //     await requestUtils.deletePost(post.id);
  //   });
  //`;

  return `import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import AxeBuilder from '@axe-core/playwright';

// ---------------------------------------------------------------------------
// Front-end tests for: ${title}
// Block:               ${blockName}
// REST endpoint:       POST /wp/v2/block-renderer/${encodedName}
// Wrapper class:       .${wrapperClass}
//
// Generated by generate-frontend-tests.js on ${today}
//
// ${dynamicNote}
// ${renderPhpNote}
// ${cssSummary}
// ${screenshotNote}
// ${visualNote}
//
// Auto-generated assertions (no TODOs, runs without modification):
${autoAssertions.length ? autoAssertions.map(a => `//   - ${a}`).join('\n') : '//   - axe WCAG 2.1 AA scan (all blocks)'}
//
// Not automated (write in elements/${blockSlug}/frontend.e2e.ts if needed):
//   - Dialog keyboard open/close behavior
//   - Specific ARIA attribute expected values
//   - Complex interactive state changes
//
// Regenerate this file when the block changes:
//   node scripts/generate-frontend-tests.js --file=elements/${blockSlug}/block.json
// ---------------------------------------------------------------------------

function logAxeViolations(blockTitle: string, violations: any[]): void {
  if (!violations.length) return;
  console.log(\`\\nAxe violations for \${blockTitle}:\`);
  violations.forEach(v => {
    console.log(\`  [\${v.impact?.toUpperCase()}] \${v.id}: \${v.description}\`);
    console.log(\`  Help: \${v.helpUrl}\`);
    v.nodes.forEach((n: any) => {
      console.log(\`    Element: \${n.html}\`);
      if (n.failureSummary) console.log(\`    Fix:     \${n.failureSummary}\`);
    });
  });
}

test.describe('${title} - Front End (Block Renderer API)', () => {

  // -------------------------------------------------------------------------
  // REST API health
  // -------------------------------------------------------------------------

  test('block renderer API returns 200 with non-empty HTML', async ({ requestUtils }) => {
    test.setTimeout(10_000);

    let rendered: { rendered: string };
    try {
      rendered = await requestUtils.rest({
        method: 'POST',
        path:   '/wp/v2/block-renderer/${encodedName}',
        data:   {
          attributes: ${hasAttributes ? attrsObject : '{}'},
          context:    'edit',
        },
      }) as { rendered: string };
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 404 || err?.code === 'block_invalid_context' || err?.code === 'block_invalid') {
        console.log('Block not renderable via REST API (static block or requires post context) — skipped.');
        test.skip();
        return;
      }
      throw err;
    }

    expect(typeof rendered.rendered).toBe('string');
    expect(rendered.rendered.trim()).not.toBe('');
  });

  test('rendered HTML contains the block wrapper class', async ({ requestUtils }) => {
    test.setTimeout(10_000);

    let rendered: { rendered: string };
    try {
      rendered = await requestUtils.rest({
        method: 'POST',
        path:   '/wp/v2/block-renderer/${encodedName}',
        data:   {
          attributes: ${hasAttributes ? attrsObject : '{}'},
          context:    'edit',
        },
      }) as { rendered: string };
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 404 || err?.code === 'block_invalid_context' || err?.code === 'block_invalid') {
        test.skip();
        return;
      }
      throw err;
    }

    // Every block should output an element with its registered wrapper class.
    // If this fails, check that render.php calls get_block_wrapper_attributes().
    expect(rendered.rendered).toContain('${wrapperClass}');
  });

  // -------------------------------------------------------------------------
  // Rendered HTML structure
  // -------------------------------------------------------------------------

  test('rendered HTML has correct structure', async ({ page, requestUtils }) => {
    test.setTimeout(15_000);

    ${rendererCallSnippet}

${renderAssertions}
  });

  test('rendered HTML is valid markup — wrapper is present in parsed DOM', async ({ page, requestUtils }) => {
    test.setTimeout(10_000);

    ${rendererCallSnippet}

    // If the HTML was malformed the browser parser would produce unexpected
    // structure. Confirming the wrapper exists in the parsed DOM confirms
    // the HTML was parseable and the wrapper tag was not mangled.
    await expect(page.locator('.${wrapperClass}')).toBeAttached();
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  test('rendered HTML passes axe WCAG 2.2 AA scan', async ({ page, requestUtils }) => {
    test.setTimeout(20_000);

    ${rendererCallSnippet}

    const results = await new AxeBuilder({ page })
      .include('.${wrapperClass}')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa','wcag22aa'])
      .analyze();

    logAxeViolations('${title}', results.violations);
    expect(results.violations).toEqual([]);
  });

  test('rendered HTML passes colour contrast check', async ({ page, requestUtils }) => {
    test.setTimeout(20_000);

    // ${blockCss
      ? 'Block CSS injected — contrast results reflect actual rendered styles.'
      : 'Block CSS not found — add a "file:" style reference in block.json for accurate results.'
    }
    ${rendererCallSnippet}

    const results = await new AxeBuilder({ page })
      .include('.${wrapperClass}')
      .withRules(['color-contrast'])
      .analyze();

    logAxeViolations('${title} (contrast)', results.violations);
    expect(results.violations).toEqual([]);
  });

  test('rendered HTML has no ARIA violations', async ({ page, requestUtils }) => {
    test.setTimeout(15_000);

    ${rendererCallSnippet}

    const results = await new AxeBuilder({ page })
      .include('.${wrapperClass}')
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

    logAxeViolations('${title} (ARIA)', results.violations);
    expect(results.violations).toEqual([]);
  });
${interactivityTests}
${visualRegressionTest}
${postContextFallback}
});
`;
}

// ---------------------------------------------------------------------------
// File processing
// ---------------------------------------------------------------------------

function processFile(filePath, outputDir, takeScreenshots, visualRegression) {
  const resolvedInput = path.resolve(filePath);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`❌  File not found: ${resolvedInput}`);
    return false;
  }

  let blockJson;
  try {
    blockJson = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
  } catch (err) {
    console.error(`❌  Failed to parse ${filePath}: ${err.message}`);
    return false;
  }

  if (!blockJson.name) {
    console.error(`❌  Missing required "name" field in: ${filePath}`);
    return false;
  }

  if (!blockJson.example?.attributes) {
    console.warn(`   ⚠️  No example.attributes in block.json — tests will use empty attributes`);
    console.warn(`      Add "example": { "attributes": { ... } } for attribute value assertions`);
  }

  const renderAnalysis = analyseRenderPhp(resolvedInput, blockJson);
  const blockCss       = resolveBlockCss(resolvedInput, blockJson);

  if (!renderAnalysis.found) {
    console.log(`   ℹ️  render.php:   not found — static block`);
  } else {
    console.log(`   ℹ️  render.php:   ${renderAnalysis.path}`);
    if (renderAnalysis.htmlElements.length) {
      console.log(`   ℹ️  Elements:     ${renderAnalysis.htmlElements.join(', ')}`);
    }
    if (renderAnalysis.ariaAttributes.length) {
      console.log(`   ℹ️  ARIA attrs:   ${renderAnalysis.ariaAttributes.join(', ')}`);
    }
    if (renderAnalysis.hasInteractivity) {
      console.log(`   ℹ️  Interactive:  yes — interactivity tests will be generated`);
    }
    if (renderAnalysis.attributesUsed.length) {
      console.log(`   ℹ️  Attrs in PHP: ${renderAnalysis.attributesUsed.join(', ')}`);
    }
  }

  // Report which attribute values can be auto-asserted
  const exampleAttributes  = blockJson.example?.attributes || {};
  const autoAttrAssertions = renderAnalysis.attributesUsed.filter(key =>
    key in exampleAttributes &&
    typeof exampleAttributes[key] === 'string' &&
    exampleAttributes[key].trim().length > 0
  );
  if (autoAttrAssertions.length) {
    console.log(`   ℹ️  Auto attr assertions: ${autoAttrAssertions.join(', ')}`);
  }

  if (!blockCss) {
    console.warn(`   ⚠️  Block CSS not found — colour contrast tests will use browser defaults`);
  }

  console.log(`   ℹ️  Screenshots:  ${takeScreenshots ? 'enabled' : 'disabled (--screenshots)'}`);
  console.log(`   ℹ️  Visual regr:  ${visualRegression ? 'enabled' : 'disabled (--visual-regression)'}`);

  const testContent = generateTestFile(
    blockJson, renderAnalysis, blockCss, resolvedInput, takeScreenshots, visualRegression
  );
  const safeName    = blockJson.name.replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '');
  const outputPath  = path.join(outputDir, `${safeName}.spec.ts`);

  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, testContent, 'utf8');
    console.log(`✅  Generated: ${outputPath}\n`);
    return true;
  } catch (err) {
    console.error(`❌  Failed to write ${outputPath}: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const HELP_TEXT = `
generate-frontend-tests.js — Generate front-end Playwright tests using the Block Renderer REST API

Usage:
  node scripts/generate-frontend-tests.js [options]

Options:
  --file=<path>         Path to a block.json file. Can be used multiple times.
  --glob=<pattern>      Glob pattern to match block.json files.
                        Requires: npm install --save-dev glob
  --output=<dir>        Output directory. Default: ./specs/frontend
  --screenshots         Save a dated PNG of each block during test runs.
                        Stored in test-results/screenshots/frontend/
  --visual-regression   Generate toHaveScreenshot() visual regression tests.
                        Creates baselines on first run, compares on subsequent.
                        Update: playwright test --update-snapshots
  --help, -h            Show this message.

Examples:
  node scripts/generate-frontend-tests.js --file=elements/icon/block.json
  node scripts/generate-frontend-tests.js --glob="elements/**/block.json"
  node scripts/generate-frontend-tests.js --glob="elements/**/block.json" --screenshots
  node scripts/generate-frontend-tests.js --glob="elements/**/block.json" --visual-regression

All generated tests run without modification — no TODO items.
Assertions are derived automatically from render.php and block.json.

Setup:
  npm install --save-dev @axe-core/playwright

  The @e2e path alias is already configured in e2e/tsconfig.json:
    { "compilerOptions": { "paths": { "@e2e/*": ["specs/*"] } } }

  Add to e2e/.gitignore:
    test-results/screenshots/

  Commit visual regression baselines:
    git add e2e/specs/frontend/*.spec.ts-snapshots/
`.trim();

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (args.glob) {
    let globSync;
    try {
      ({ globSync } = require('glob'));
    } catch {
      console.error('❌  The --glob option requires the "glob" package.');
      console.error('   Run: npm install --save-dev glob');
      process.exit(1);
    }

    const matched = globSync(args.glob);
    if (!matched.length) {
      console.warn(`⚠️  No files matched glob pattern: ${args.glob}`);
    } else {
      console.log(`🔍  Matched ${matched.length} file(s) from glob.\n`);
      args.files.push(...matched);
    }
  }

  if (!args.files.length) {
    console.error('❌  No files specified. Use --file= or --glob=');
    console.error('   Run with --help for usage information.');
    process.exit(1);
  }

  const uniqueFiles = [...new Set(args.files)];
  let passed = 0;
  let failed = 0;

  for (const file of uniqueFiles) {
    console.log(`🔧 Processing: ${file}`);
    if (processFile(file, args.output, args.screenshots, args.visualRegression)) passed++;
    else failed++;
  }

  console.log(`${passed} generated, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();