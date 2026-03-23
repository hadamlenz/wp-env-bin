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
    output:           './wp-env-bin/e2e/specs/frontend',
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
// Full test file generator
// ---------------------------------------------------------------------------

/**
 * Generates the thin front-end spec file content for a block.
 * All test logic lives in wp-env-bin/lib/e2e/frontend-tests.ts and is
 * imported at test runtime. This file is a thin manifest — a config
 * object derived from block.json and render.php passed to registerFrontendTests().
 *
 * @param {object}      blockJson
 * @param {object}      renderAnalysis
 * @param {string|null} blockCss
 * @param {string}      blockJsonPath
 * @param {boolean}     takeScreenshots
 * @param {boolean}     visualRegression
 * @returns {string}
 */
function generateTestFile(blockJson, renderAnalysis, blockCss, takeScreenshots, visualRegression) {
  const blockName         = blockJson.name;
  const title             = blockJson.title || blockName;
  const exampleAttributes = blockJson.example?.attributes || {};
  const apiAttributes     = sanitizeAttributesForApi(exampleAttributes, blockJson.attributes || {});
  const today             = new Date().toISOString().split('T')[0];
  const blockSlug         = blockName.split('/')[1] ?? blockName;

  // Build contentAssertions: attribute keys used in render.php whose example
  // values are plain strings that should appear verbatim in the rendered HTML.
  const PALETTE_SLUG_RE  = /^[a-z][a-z0-9-]+$/;
  const issetGuarded     = new Set(renderAnalysis.attributesIssetGuarded || []);
  const contentAssertions = renderAnalysis.attributesUsed
    .filter(key => {
      if (!(key in exampleAttributes)) return false;
      const val = exampleAttributes[key];
      if (typeof val !== 'string' || !val.trim()) return false;
      if (/color/i.test(key) && PALETTE_SLUG_RE.test(val.trim())) return false;
      if (issetGuarded.has(key)) return false;
      return true;
    })
    .map(key => ({ key, value: exampleAttributes[key] }));

  const config = {
    blockName,
    title,
    apiAttributes,
    ...(renderAnalysis.htmlElements.length   ? { htmlElements: renderAnalysis.htmlElements }     : {}),
    ...(renderAnalysis.ariaAttributes.length ? { ariaAttributes: renderAnalysis.ariaAttributes } : {}),
    ...(contentAssertions.length             ? { contentAssertions }                             : {}),
    ...(renderAnalysis.hasInteractivity      ? { hasInteractiveDirectives: true }                : {}),
    ...(blockCss                             ? { blockCss }                                      : {}),
    ...(takeScreenshots                      ? { screenshots: true }                             : {}),
    ...(visualRegression                     ? { visualRegression: true }                        : {}),
  };

  return `import { test } from '@wordpress/e2e-test-utils-playwright';
import { registerFrontendTests } from '@e2e/utils/frontend-tests';

// Generated by generate-frontend-tests.js on ${today}
// Regenerate: node wp-env-bin/lib/e2e/generate-frontend-tests.js --file=<path-to>/block.json
// Block-specific interactive behavior tests: elements/${blockSlug}/frontend.e2e.ts

registerFrontendTests(test, ${JSON.stringify(config, null, 2)});
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
    blockJson, renderAnalysis, blockCss, takeScreenshots, visualRegression
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
  --output=<dir>        Output directory. Default: ./e2e/specs/frontend
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
      const g = require('glob');
      globSync = g.globSync || g.sync; // v10+ uses globSync, v7 uses sync
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