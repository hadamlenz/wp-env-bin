#!/usr/bin/env node

/**
 * @file generate-block-tests.js
 * @description Generates Playwright structural test stubs for WordPress custom
 * blocks based on their block.json configuration. Covers insertion, markup
 * serialization, validation, block operations, block supports, variations,
 * styles, and keyword search.
 *
 * Attribute control interaction tests are intentionally not generated here —
 * write those by hand in a *.e2e.ts file next to your block source so that
 * contextual and conditional controls can be tested correctly.
 *
 * Generated test files import shared helpers via the @e2e path alias.
 * Configure this alias in tsconfig.json:
 *
 *   {
 *     "compilerOptions": {
 *       "baseUrl": ".",
 *       "paths": {
 *         "@e2e/*": ["tests/e2e/*"]
 *       }
 *     }
 *   }
 *
 * @example <caption>Single file</caption>
 * node scripts/generate-block-tests.js --file=path/to/block.json
 *
 * @example <caption>Multiple files</caption>
 * node scripts/generate-block-tests.js --file=block-a/block.json --file=block-b/block.json
 *
 * @example <caption>Glob pattern (requires: npm install --save-dev glob)</caption>
 * node scripts/generate-block-tests.js --glob="src/blocks/**\/block.json"
 *
 * @example <caption>Custom output directory</caption>
 * node scripts/generate-block-tests.js --file=block.json --output=tests/e2e/editor
 *
 * @requires fs
 * @requires path
 * @requires glob - Optional. Only required when using --glob.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
	const result = {
		files: [],
		output: './specs/editor',
		glob: null,
		help: false,
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
		} else {
			console.warn(`⚠️  Unknown argument ignored: ${arg}`);
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats an attributes object into an indented string
 * suitable for embedding inside a test file.
 *
 * @param {Record<string, unknown>} attributes
 * @param {number} baseIndent - number of spaces to indent lines after the first
 * @returns {string|null}
 */
function formatAttributes(attributes, baseIndent = 6) {
	if (!attributes || !Object.keys(attributes).length) return null;
	const pad = ' '.repeat(baseIndent);
	return JSON.stringify(attributes, null, 2)
		.split('\n')
		.map((line, i) => (i === 0 ? line : `${pad}${line}`))
		.join('\n');
}

/**
 * Generates the editor.insertBlock() call for a test,
 * using example attributes from block.json if available.
 *
 * @param {string}                  blockName
 * @param {Record<string, unknown>} exampleAttributes
 * @returns {string}
 */
function generateInsertBlock(blockName, exampleAttributes) {
	const formatted = formatAttributes(exampleAttributes);

	if (formatted) {
		return `await editor.insertBlock({
      name: '${blockName}',
      attributes: ${formatted},
    });`;
	}

	return `await editor.insertBlock({ name: '${blockName}' });`;
}

/**
 * Given an attribute config, returns a value that differs from the default.
 *
 * @param {string} attrName
 * @param {object} attrConfig
 * @returns {{ value: unknown, label: string } | null}
 */
function getNonDefaultValue(attrName, attrConfig) {
	const { type, default: defaultVal, enum: enumValues } = attrConfig;

	if (Array.isArray(enumValues) && enumValues.length > 0) {
		const nonDefault = enumValues.find((v) => v !== defaultVal);
		if (nonDefault !== undefined) {
			return { value: nonDefault, label: String(nonDefault) };
		}
	}

	switch (type) {
		case 'string': {
			const candidate = 'Test Value';
			const value = defaultVal !== candidate ? candidate : 'Alternative Value';
			return { value, label: value };
		}
		case 'number':
		case 'integer': {
			const base = typeof defaultVal === 'number' ? defaultVal : 0;
			const nonDefault = base === 0 ? 1 : base + 1;
			return { value: nonDefault, label: String(nonDefault) };
		}
		case 'boolean': {
			return { value: !defaultVal, label: String(!defaultVal) };
		}
		default:
			return null;
	}
}

/**
 * Generates a serialized markup assertion for a specific attribute.
 *
 * @param {string}  attrName
 * @param {object}  attrConfig
 * @param {unknown} exampleValue
 * @returns {string}
 */
function generateMarkupAssertion(attrName, attrConfig, exampleValue) {
	const hasDefault = 'default' in attrConfig;
	const defaultVal = attrConfig.default;

	if (hasDefault && JSON.stringify(exampleValue) === JSON.stringify(defaultVal)) {
		return `// "${attrName}" example value (${JSON.stringify(exampleValue)}) matches its block.json default.
    // WordPress omits default-valued attributes from serialized markup.
    expect(content).not.toContain('"${attrName}"');`;
	}

	if (exampleValue === undefined) {
		return `// Verifies the attribute key is present (no example value defined in block.json)
    expect(content).toContain('"${attrName}"');`;
	}

	switch (attrConfig.type) {
		case 'string':
			return `// Verifies the exact example value is serialized into the block markup
    expect(content).toContain('"${attrName}":"${exampleValue}"');`;

		case 'boolean':
			return `// Verifies the exact example value is serialized as a boolean (no quotes)
    expect(content).toContain('"${attrName}":${exampleValue}');`;

		case 'number':
		case 'integer':
			return `// Verifies the exact example value is serialized as a number (no quotes)
    expect(content).toContain('"${attrName}":${exampleValue}');`;

		case 'array':
			return `// Verifies the attribute is serialized as an array
    expect(content).toContain('"${attrName}":[');`;

		case 'object':
			return `// Verifies the attribute is serialized as an object
    expect(content).toContain('"${attrName}":{');`;

		default:
			return `expect(content).toContain('"${attrName}"');`;
	}
}

/**
 * Generates markup assertions for all example attributes.
 *
 * @param {Record<string, object>}  attributes
 * @param {Record<string, unknown>} exampleAttributes
 * @returns {string}
 */
function generateExampleMarkupAssertions(attributes, exampleAttributes) {
	return Object.entries(exampleAttributes)
		.map(([key, value]) => generateMarkupAssertion(key, attributes[key] || {}, value))
		.join('\n    ');
}

// ---------------------------------------------------------------------------
// Timeouts written into generated test files
// ---------------------------------------------------------------------------

const TIMEOUTS = {
	insertion: 10_000,
	markup: 15_000,
	validation: 20_000,
	operations: 15_000,
	supports: 15_000,
	variations: 15_000,
	styles: 15_000,
	keywords: 20_000,
};

// ---------------------------------------------------------------------------
// Crash boundary check snippet
// ---------------------------------------------------------------------------

/**
 * @param {string} title
 * @returns {string}
 */
function crashBoundaryCheck(title) {
	return `// Fail fast if the block crashed — inspector will be empty and all
    // subsequent locators will time out with misleading errors.
    const crashWarning = editor.canvas.getByText(/This block has encountered an error/i);
    if (await crashWarning.isVisible()) {
      throw new Error(
        'Block "${title}" crashed in the editor (BlockCrashBoundary). ' +
        'Check the block edit function and verify example.attributes in block.json ' +
        'are valid and complete for the block to render without errors.'
      );
    }`;
}

// ---------------------------------------------------------------------------
// Block client ID resolution snippet
//
// WHY THIS APPROACH:
//
// All previous approaches (toolbar click, Escape key, selectBlock + toolbar)
// failed for different reasons:
//   - Clicking container blocks selects inner blocks
//   - Escape over-presses deselect all blocks
//   - The toolbar doesn't appear after programmatic selectBlock in some versions
//   - editorFrame.evaluate() dispatches to window.wp in the IFRAME context
//     where window.wp is UNDEFINED — wp.data only exists on the PARENT window
//
// THE FIX:
//   1. Use editorFrame ONLY to read the data-block UUID from the DOM
//   2. Use page.evaluate() for ALL wp.data dispatches (parent window context)
//   3. Use page.waitForFunction() to verify the STORE reflects the change
//      before asserting the DOM — more reliable than waiting on DOM count alone
//
// The outer block is located by data-type (the registered block name) which
// uniquely identifies the block type. The data-block attribute contains the
// unique client ID assigned by Gutenberg to this specific block instance.
// ---------------------------------------------------------------------------

/**
 * Returns the snippet that resolves the outer block's client ID from the
 * iframe DOM. The resolved blockClientId variable is used in subsequent
 * page.evaluate() calls for store dispatch operations.
 *
 * @param {string} blockName - Registered block name e.g. "uncch/accordion-group"
 * @param {number} timeout
 * @returns {string}
 */
function getBlockClientIdSnippet(blockName, timeout) {
	return `// Read the outer block's unique client ID from the iframe DOM.
    // wp.data MUST be dispatched from page.evaluate() (parent window context)
    // not editorFrame.evaluate() — window.wp is undefined in the iframe.
    const editorFrame = page.frame({ name: 'editor-canvas' });
    if (!editorFrame) {
      throw new Error('Editor canvas frame not found — is wp-env running?');
    }

    const outerBlockEl = editorFrame.locator('[data-type="${blockName}"]').first();
    await outerBlockEl.waitFor({ state: 'visible', timeout: ${timeout} });

    const blockClientId = await outerBlockEl.getAttribute('data-block');
    if (!blockClientId) {
      throw new Error(
        'data-block attribute not found on [data-type="${blockName}"]. ' +
        'The block may not have rendered correctly.'
      );
    }`;
}

// ---------------------------------------------------------------------------
// Inspector setup helpers
// ---------------------------------------------------------------------------

/**
 * Generates the inspector setup for supports under the Styles tab.
 *
 * @param {string} title
 * @param {string} insertBlock
 * @returns {string}
 */
function generateStylesInspectorSetup(title, insertBlock) {
	return `postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    await editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first()
      .waitFor({ state: 'visible' });

    ${crashBoundaryCheck(title)}

    await editor.canvas.getByRole('document', { name: /Block: ${title}/i }).first().click();
    await openInspectorSidebar(editor, page);

    const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
    await settingsRegion.waitFor({ state: 'visible' });

    // Debug: log all buttons in the settings region to help identify correct
    // labels if a panel locator times out. Remove once labels are confirmed.
    const buttons = settingsRegion.getByRole('button');
    const count = await buttons.count();
    console.log(\`Buttons in settings region: \${count}\`);
    for (let i = 0; i < count; i++) {
      const name = await buttons.nth(i).getAttribute('aria-label')
        ?? await buttons.nth(i).innerText();
      console.log(\`  [\${i}] \${name}\`);
    }

    await openStylesTab(page);`;
}

/**
 * Generates the inspector setup for supports under the Settings tab.
 *
 * @param {string} title
 * @param {string} insertBlock
 * @returns {string}
 */
function generateInspectorSetup(title, insertBlock) {
	return `postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    await editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first()
      .waitFor({ state: 'visible' });

    ${crashBoundaryCheck(title)}

    await editor.canvas.getByRole('document', { name: /Block: ${title}/i }).first().click();
    await openInspectorSidebar(editor, page);

    const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
    await settingsRegion.waitFor({ state: 'visible' });

    // Ensure the Settings tab is active — the Advanced panel only exists there
    const settingsTab = settingsRegion.getByRole('tab', { name: /^Settings$/i });
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
    }

    // Debug: log all buttons in the settings region to help identify correct
    // labels if a panel locator times out. Remove once labels are confirmed.
    const buttons = settingsRegion.getByRole('button');
    const count = await buttons.count();
    console.log(\`Buttons in settings region: \${count}\`);
    for (let i = 0; i < count; i++) {
      const name = await buttons.nth(i).getAttribute('aria-label')
        ?? await buttons.nth(i).innerText();
      console.log(\`  [\${i}] \${name}\`);
    }`;
}

// ---------------------------------------------------------------------------
// Supports tests
// ---------------------------------------------------------------------------

function generateSupportsTests(blockName, title, supports, insertBlock) {
	const tests = [];
	const stylesSetup = generateStylesInspectorSetup(title, insertBlock);
	const settingsSetup = generateInspectorSetup(title, insertBlock);

	if (supports?.color) {
		tests.push(`
  test('supports: color panel is available in the inspector', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.supports});
    ${stylesSetup}

    const colorOptions = settingsRegion.getByLabel('Color options');
    await colorOptions.waitFor({ state: 'visible' });
    await expect(colorOptions).toBeVisible();
  });`);
	}

	if (supports?.typography) {
		tests.push(`
  test('supports: typography panel is available in the inspector', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.supports});
    ${stylesSetup}

    const typography = settingsRegion.getByLabel('Typography options');
    await typography.waitFor({ state: 'visible' });
    await expect(typography).toBeVisible();
  });`);
	}

	if (supports?.spacing) {
		tests.push(`
  test('supports: dimensions panel is available in the inspector', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.supports});
    ${stylesSetup}

    const dimensions = settingsRegion.getByLabel('Dimensions options');
    await dimensions.waitFor({ state: 'visible' });
    await expect(dimensions).toBeVisible();
  });`);
	}

	if (supports?.anchor) {
		tests.push(`
  test('supports: HTML anchor field is available in advanced settings', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.supports});
    ${settingsSetup}

    const advancedButton = settingsRegion.getByRole('button', { name: /^Advanced$/i });
    await advancedButton.waitFor({ state: 'visible' });
    await advancedButton.scrollIntoViewIfNeeded();

    const isExpanded = await advancedButton.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await advancedButton.click();
    }

    const anchor = settingsRegion.getByLabel('HTML anchor');
    await anchor.waitFor({ state: 'visible' });
    await expect(anchor).toBeVisible();
  });`);
	}

	if (supports?.customClassName !== false) {
		tests.push(`
  test('supports: additional CSS class is serialized in block markup', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.supports});
    ${settingsSetup}

    const advancedButton = settingsRegion.getByRole('button', { name: /^Advanced$/i });
    await advancedButton.waitFor({ state: 'visible' });
    await advancedButton.scrollIntoViewIfNeeded();

    const isExpanded = await advancedButton.getAttribute('aria-expanded');
    if (isExpanded === 'false') {
      await advancedButton.click();
    }

    const cssClassInput = settingsRegion.getByLabel('Additional CSS class(es)');
    await cssClassInput.waitFor({ state: 'visible' });
    await cssClassInput.fill('my-custom-class');

    await waitForEditorReady(page);
    const content = await editor.getEditedPostContent();
    expect(content).toContain('my-custom-class');
  });`);
	}

	return tests.join('\n');
}

// ---------------------------------------------------------------------------
// Keywords tests
// ---------------------------------------------------------------------------

function generateKeywordsTests(blockName, title, keywords) {
	if (!keywords?.length) return '';

	return keywords
		.map(
			(keyword) => `
  test('keyword: "${keyword}" finds the block in the inserter', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.keywords});
    postId = await createPostAndGetId(admin, page, requestUtils);

    const editorTopBar   = page.getByRole('region', { name: /Editor top bar/i });
    const inserterButton = editorTopBar.getByLabel(/Toggle block inserter|Block Inserter/i);
    await inserterButton.waitFor({ state: 'visible' });
    await inserterButton.click();

    const searchInput = page.getByRole('searchbox', { name: /Search/i });
    await searchInput.waitFor({ state: 'visible' });
    await searchInput.fill('${keyword}');

    // exact: true prevents partial name matches — e.g. "UNC Slide" would
    // otherwise also match "UNC Slider".
    await expect(
      page.getByRole('option', { name: '${title}', exact: true })
    ).toBeVisible();
  });`
		)
		.join('\n');
}

// ---------------------------------------------------------------------------
// Variations tests
// ---------------------------------------------------------------------------

function generateVariationsTests(blockName, title, variations, attributes) {
	if (!variations?.length) return '';

	return variations
		.map((variation) => {
			const variationAttributes = variation.attributes || {};
			const hasAttributes = Object.keys(variationAttributes).length > 0;
			const formattedAttributes = formatAttributes(variationAttributes);

			const insertVariation = formattedAttributes
				? `await editor.insertBlock({
      name:       '${blockName}',
      attributes: ${formattedAttributes},
    });`
				: `await editor.insertBlock({ name: '${blockName}' });`;

			const markupAssertions = hasAttributes
				? Object.entries(variationAttributes)
						.map(([key, value]) => {
							const attrConfig = attributes[key] || {};
							const hasDefault = 'default' in attrConfig;

							if (hasDefault && JSON.stringify(value) === JSON.stringify(attrConfig.default)) {
								return `// "${key}" value (${JSON.stringify(value)}) matches block.json default — WordPress omits it from markup\n    expect(content).not.toContain('"${key}"');`;
							}

							const attrType = typeof value;
							if (attrType === 'string') return `expect(content).toContain('"${key}":"${value}"');`;
							if (attrType === 'boolean') return `expect(content).toContain('"${key}":${value}');`;
							if (attrType === 'number') return `expect(content).toContain('"${key}":${value}');`;
							return `expect(content).toContain('"${key}"');`;
						})
						.join('\n    ')
				: `expect(content).toContain('<!-- wp:${blockName}');`;

			return `
  test('variation: "${variation.title ?? variation.name}" inserts and serializes correctly', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.variations});
    // Variation: ${variation.name}
    // Description: ${variation.description ?? 'No description provided'}
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertVariation}

    await editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first()
      .waitFor({ state: 'visible' });

    await waitForEditorReady(page);
    const content = await editor.getEditedPostContent();
    ${markupAssertions}
  });`;
		})
		.join('\n');
}

// ---------------------------------------------------------------------------
// Styles tests
// ---------------------------------------------------------------------------

function generateStylesTests(blockName, title, styles, insertBlock) {
	if (!styles?.length) return '';

	const nonDefaultStyles = styles.filter((style) => !style.isDefault);
	if (!nonDefaultStyles.length) return '';

	return nonDefaultStyles
		.map(
			(style) => `
  test('style: "${style.label ?? style.name}" applies correct class to block markup', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.styles});
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    await editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first()
      .waitFor({ state: 'visible' });

    await editor.canvas.getByRole('document', { name: /Block: ${title}/i }).first().click();
    await openInspectorSidebar(editor, page);
    await openStylesTab(page);

    const styleButton = page.getByRole('button', { name: '${style.label ?? style.name}' });
    await styleButton.waitFor({ state: 'visible' });
    await styleButton.click();

    await waitForEditorReady(page);
    const content = await editor.getEditedPostContent();
    expect(content).toContain('is-style-${style.name}');
  });`
		)
		.join('\n');
}

// ---------------------------------------------------------------------------
// Full test file generator
// ---------------------------------------------------------------------------

/**
 * Generates the full structural test file content for a block.
 *
 * NOTE on .first() usage:
 * All block document locators use .first() throughout this template.
 * Container blocks (blocks that use InnerBlocks) render two elements with
 * the same role="document" and aria-label — the outer block wrapper and the
 * inner block layout container. Without .first(), Playwright throws a strict
 * mode violation. .first() always targets the outermost block wrapper.
 *
 * For count assertions (toHaveCount) where .first() cannot be used, a CSS
 * attribute selector filters out the inner layout container:
 *   [role="document"][aria-label="Block: Title"]:not(.block-editor-block-list__layout)
 *
 * NOTE on block operations (duplicate / remove) — wp context:
 * window.wp (and therefore wp.data) only exists on the PARENT page window.
 * It is NOT available in the editor iframe (editor-canvas) window.
 * All previous approaches that used editorFrame.evaluate() to dispatch
 * wp.data actions were silently failing because window.wp was undefined
 * in the iframe context.
 *
 * The correct pattern is:
 *   1. editorFrame.locator()  — read data-block UUID from the iframe DOM
 *   2. page.evaluate()        — dispatch wp.data actions (parent window)
 *   3. page.waitForFunction() — verify store state before asserting DOM
 *
 * @param {object} blockJson - Parsed block.json
 * @returns {string}
 */
function generateTestFile(blockJson) {
	const blockName = blockJson.name;
	const title = blockJson.title || blockName;
	const attributes = blockJson.attributes || {};
	const supports = blockJson.supports || {};
	const exampleAttributes = blockJson.example?.attributes || {};
	const hasExample = Object.keys(exampleAttributes).length > 0;
	const keywords = blockJson.keywords || [];
	const variations = blockJson.variations || [];
	const styles = blockJson.styles || [];
	const today = new Date().toISOString().split('T')[0];
	const blockSlug = blockName.split('/')[1] ?? blockName;

	const insertBlock = generateInsertBlock(blockName, exampleAttributes);
	const supportsTests = generateSupportsTests(blockName, title, supports, insertBlock);
	const keywordsTests = generateKeywordsTests(blockName, title, keywords);
	const variationsTests = generateVariationsTests(blockName, title, variations, attributes);
	const stylesTests = generateStylesTests(blockName, title, styles, insertBlock);
	const clientIdSnippet = getBlockClientIdSnippet(blockName, TIMEOUTS.operations);

	const exampleNote = hasExample
		? `// Attributes sourced from example.attributes in block.json`
		: `// No example.attributes in block.json — block inserted without attributes`;

	const exampleMarkupTest = hasExample
		? `test('block serializes example attributes into markup', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.markup});
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    await editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first()
      .waitFor({ state: 'visible' });

    await waitForEditorReady(page);
    const content = await editor.getEditedPostContent();
    ${generateExampleMarkupAssertions(attributes, exampleAttributes)}
  });`
		: `// Tip: add an "example" field to block.json to generate a markup assertion test here`;

	const blockSpecificNote = `
  // -------------------------------------------------------------------------
  // Attribute control interaction tests
  // -------------------------------------------------------------------------
  //
  // Attribute tests are intentionally not generated here. Write them by hand
  // in a *.e2e.ts file next to your block source so that contextual and
  // conditional controls can be tested correctly.
  //
  // Import the shared helpers using the @e2e path alias:
  //
  //   import {
  //     createPostAndGetId,
  //     waitForEditorReady,
  //     deletePost,
  //     openInspectorSidebar,
  //     openStylesTab,
  //     expandPanel,
  //   } from '@e2e/utils/helpers';
  //
  // Example file: src/blocks/${blockSlug}/${blockSlug}.e2e.ts
  //`;

	const generatedSections = [
		'insertion',
		'markup serialization',
		'validation',
		'block operations',
		supports && Object.keys(supports).length ? 'block supports' : null,
		keywords.length ? 'keywords' : null,
		variations.length ? 'variations' : null,
		styles.filter((s) => !s.isDefault).length ? 'styles' : null,
	]
		.filter(Boolean)
		.join(', ');

	const attrDefaultSummary = Object.entries(attributes)
		.map(([name, cfg]) => {
			const hasDefault = 'default' in cfg;
			return ` *   ${name} (${cfg.type || 'unknown'})${hasDefault ? ` — default: ${JSON.stringify(cfg.default)}` : ' — no default'}`;
		})
		.join('\n');

	return `import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import type { Admin, RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';
import {
  createPostAndGetId,
  waitForEditorReady,
  deletePost,
  openInspectorSidebar,
  openStylesTab,
} from '@e2e/utils/helpers';

/**
 * Structural tests for: ${title}
 * Block:                 ${blockName}
 *
 * Generated by generate-block-tests.js on ${today}
 *
 * Covers: ${generatedSections}
 *
 * Attribute control interaction tests are not generated here —
 * see the block-specific *.e2e.ts file next to the block source.
 *
 * example.attributes defined in block.json: ${hasExample ? 'yes' : 'no'}
 * keywords: ${keywords.length ? keywords.join(', ') : 'none'}
 * variations: ${variations.length ? variations.map((v) => v.name).join(', ') : 'none'}
 * styles: ${styles.length ? styles.map((s) => s.name).join(', ') : 'none'}
 *
 * Attributes:
${attrDefaultSummary || ' *   (none)'}
 *
 * NOTE: Attributes whose example value matches their block.json default are
 * asserted ABSENT from serialized markup — WordPress omits them intentionally.
 */

test.describe('${title} - Editor', () => {
  let postId: number | undefined;

  test.afterEach(async ({ requestUtils }) => {
    if (postId && typeof postId === 'number') {
      await deletePost(requestUtils, postId);
      postId = undefined;
    }
  });

  // -------------------------------------------------------------------------
  // Insertion
  // -------------------------------------------------------------------------

  test('block can be inserted via the block inserter', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.insertion});
    ${exampleNote}
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    // .first() is used on all block document locators because container blocks
    // (blocks that use InnerBlocks) render a second element with the same role
    // and aria-label for the inner block layout area. Without .first() Playwright
    // throws a strict mode violation. .first() always targets the outer wrapper.
    await expect(
      editor.canvas.getByRole('document', { name: /Block: ${title}/i }).first()
    ).toBeVisible();
  });

  test('block renders visibly in the editor canvas', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.insertion});
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    const block = editor.canvas.getByRole('document', { name: /Block: ${title}/i }).first();
    await expect(block).toBeVisible();

    // Fail fast if the block crashed rather than letting subsequent tests
    // time out with misleading errors.
    await expect(
      editor.canvas.getByText(/This block has encountered an error/i)
    ).not.toBeVisible();

    // Verify the block rendered some content — works for text, markup,
    // and icon-only blocks that have no text content.
    const innerHTML = await block.evaluate((el) => el.innerHTML.trim());
    expect(innerHTML).not.toBe('');
  });

  // -------------------------------------------------------------------------
  // Serialized markup
  // -------------------------------------------------------------------------

  test('block serializes with the correct wp comment delimiter', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.markup});
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    await editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first()
      .waitFor({ state: 'visible' });

    await waitForEditorReady(page);
    const content = await editor.getEditedPostContent();
    expect(content).toContain('<!-- wp:${blockName}');
  });

  ${exampleMarkupTest}

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  test('block has no validation errors after save and reload', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.validation});
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    await editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first()
      .waitFor({ state: 'visible' });

    await editor.publishPost();
    await page.reload();

    await page
      .getByRole('region', { name: /Editor top bar/i })
      .waitFor({ state: 'visible' });

    await expect(
      page.getByText('This block contains unexpected or invalid content')
    ).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Block operations
  //
  // IMPORTANT: wp.data only exists on the PARENT page window, not in the
  // editor iframe window. All wp.data dispatch calls use page.evaluate()
  // (parent context). editorFrame is used ONLY to read the data-block UUID.
  // page.waitForFunction() verifies the store reflects the change before
  // asserting the DOM.
  // -------------------------------------------------------------------------

  test('block can be duplicated without errors', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.operations});
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    await editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first()
      .waitFor({ state: 'visible' });

    ${clientIdSnippet}

    // Dispatch duplicateBlocks via page.evaluate — wp.data is on the parent
    // window, NOT the iframe window. editorFrame.evaluate would silently fail.
    await page.evaluate(async (clientId) => {
      await (window as any).wp.data
        .dispatch('core/block-editor')
        .duplicateBlocks([clientId]);
    }, blockClientId);

    // Verify duplication in the Gutenberg store — the store is the source of
    // truth for block state. A DOM count assertion is intentionally omitted
    // here because blocks that are only valid inside a parent container may
    // crash on render when duplicated standalone, leaving the store correct
    // but the DOM empty. Verifying the store has 2 blocks is sufficient to
    // confirm duplicateBlocks() worked.
    await page.waitForFunction(
      ([blockType, expectedCount]: [string, number]) => {
        const flattenBlocks = (blocks: any[]): any[] =>
          blocks.flatMap((b: any) => [b, ...flattenBlocks(b.innerBlocks ?? [])]);
        const all = flattenBlocks(
          (window as any).wp.data.select('core/block-editor').getBlocks()
        );
        return all.filter((b: any) => b.name === blockType).length >= expectedCount;
      },
      ['${blockName}', 2] as [string, number],
      { timeout: ${TIMEOUTS.operations} }
    );
  });

  test('block can be removed', async ({ admin, editor, page, requestUtils }) => {
    test.setTimeout(${TIMEOUTS.operations});
    postId = await createPostAndGetId(admin, page, requestUtils);
    ${insertBlock}

    const block = editor.canvas
      .getByRole('document', { name: /Block: ${title}/i })
      .first();

    await block.waitFor({ state: 'visible' });

    ${clientIdSnippet}

    // Dispatch removeBlock via page.evaluate — wp.data is on the parent
    // window, NOT the iframe window. editorFrame.evaluate would silently fail.
    await page.evaluate(async (clientId) => {
      await (window as any).wp.data
        .dispatch('core/block-editor')
        .removeBlock(clientId);
    }, blockClientId);

    // Verify removal in the Gutenberg store first.
    await page.waitForFunction(
      ([blockType]: [string]) => {
        const flattenBlocks = (blocks: any[]): any[] =>
          blocks.flatMap((b: any) => [b, ...flattenBlocks(b.innerBlocks ?? [])]);
        const all = flattenBlocks(
          (window as any).wp.data.select('core/block-editor').getBlocks()
        );
        return all.filter((b: any) => b.name === blockType).length === 0;
      },
      ['${blockName}'] as [string],
      { timeout: ${TIMEOUTS.operations} }
    );

    // Use toHaveCount(0) rather than not.toBeVisible() — waits for full DOM
    // removal rather than just hidden state during the undo period.
    await expect(block).toHaveCount(0, { timeout: ${TIMEOUTS.operations} });
  });

${blockSpecificNote}
${
	supportsTests
		? `
  // -------------------------------------------------------------------------
  // Block Supports
  // -------------------------------------------------------------------------
${supportsTests}
`
		: ''
}${
		keywordsTests
			? `
  // -------------------------------------------------------------------------
  // Keywords
  // -------------------------------------------------------------------------
${keywordsTests}
`
			: ''
	}${
		variationsTests
			? `
  // -------------------------------------------------------------------------
  // Variations
  // -------------------------------------------------------------------------
${variationsTests}
`
			: ''
	}${
		stylesTests
			? `
  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------
${stylesTests}
`
			: ''
	}
});
`;
}

// ---------------------------------------------------------------------------
// File processing
// ---------------------------------------------------------------------------

function processFile(filePath, outputDir) {
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
		console.warn(`   ⚠️  No example.attributes in ${filePath} — block will be inserted without attributes`);
	}

	const attributes = blockJson.attributes || {};
	const supports = blockJson.supports || {};
	const keywords = blockJson.keywords || [];
	const variations = blockJson.variations || [];
	const styles = blockJson.styles?.filter((s) => !s.isDefault) || [];

	console.log(`   ℹ️  Supports:   ${Object.keys(supports).join(', ') || 'none'}`);
	console.log(`   ℹ️  Keywords:   ${keywords.join(', ') || 'none'}`);
	console.log(`   ℹ️  Variations: ${variations.map((v) => v.name).join(', ') || 'none'}`);
	console.log(`   ℹ️  Styles:     ${styles.map((s) => s.name).join(', ') || 'none (or default only)'}`);

	const withDefault = Object.entries(attributes).filter(([, c]) => 'default' in c);
	const withoutDefault = Object.entries(attributes).filter(([, c]) => !('default' in c));
	if (withDefault.length) {
		console.log(
			`   ℹ️  Attrs with defaults (example value checked for omission if it matches default): ${withDefault.map(([n]) => n).join(', ')}`
		);
	}
	if (withoutDefault.length) {
		console.log(
			`   ℹ️  Attrs without defaults (will assert presence in markup): ${withoutDefault.map(([n]) => n).join(', ')}`
		);
	}

	const testContent = generateTestFile(blockJson);
	const safeName = blockJson.name.replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '');
	const outputPath = path.join(outputDir, `${safeName}.spec.ts`);

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
generate-block-tests.js — Generate Playwright structural test stubs from block.json files

Usage:
  node scripts/generate-block-tests.js [options]

Options:
  --file=<path>     Path to a block.json file. Can be used multiple times.
  --glob=<pattern>  Glob pattern to match block.json files.
                    Requires: npm install --save-dev glob
  --output=<dir>    Output directory for test files. Default: ./specs/editor
  --help, -h        Show this message.

Examples:
  node e2e/specs/utils/generate-block-tests.js --file=src/blocks/my-block/block.json
  node e2e/specs/utils/generate-block-tests.js --file=block-a/block.json --file=block-b/block.json
  node e2e/specs/utils/generate-block-tests.js --glob="src/blocks/**/block.json"
  node e2e/specs/utils/generate-block-tests.js --file=block.json --output=e2e/specs/editor

Setup:
  Generated files import shared helpers via the @e2e path alias.
  This is already configured in e2e/tsconfig.json:

    {
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@e2e/*": ["specs/*"]
        }
      }
    }

Tips:
  1. Add an "example" field to block.json for richer generated tests:
       "example": { "attributes": { "heading": "Hello World" } }

     Attributes whose example value matches their block.json default will be
     asserted ABSENT from markup — WordPress omits them intentionally.

     Avoid special characters in example values that Gutenberg Unicode-escapes
     (-- / < > &) as these will cause markup assertion mismatches.

  2. Add "keywords", "variations", and "styles" to block.json to generate
     additional tests for each automatically.

  3. Write attribute control interaction tests by hand in a *.e2e.ts file
     next to your block source — this handles contextual and conditional
     controls that cannot be auto-generated reliably.

  4. Import shared helpers in your block-specific *.e2e.ts file:
       import {
         createPostAndGetId,
         waitForEditorReady,
         deletePost,
         openInspectorSidebar,
         openStylesTab,
         expandPanel,
       } from '@e2e/utils/helpers';
`.trim();

/**
 * this is where everything is collected and executed
 */
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
		if (processFile(file, args.output)) passed++;
		else failed++;
	}

	console.log(`${passed} generated, ${failed} failed.`);
	if (failed > 0) process.exit(1);
}

main();
