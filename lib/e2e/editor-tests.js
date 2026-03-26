"use strict";
/**
 * @file editor-tests.ts
 * @description Registers Playwright structural editor tests for a WordPress block.
 *
 * Call registerEditorTests(test, config) in a generated spec file.
 * The config is derived from block.json at generation time via wp-env-bin.
 *
 * @example
 * import { test } from '@wordpress/e2e-test-utils-playwright';
 * import { registerEditorTests } from '@e2e/utils/editor-tests';
 * registerEditorTests(test, { blockName: 'my/block', title: 'My Block', ... });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEditorTests = registerEditorTests;
exports.registerEditorTestsFromConfig = registerEditorTestsFromConfig;
/* eslint-disable @typescript-eslint/no-require-imports */
const test_1 = require("@playwright/test");
const helpers_1 = require("./helpers");
const block_loader_1 = require("./block-loader");
// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------
const TIMEOUTS = {
    insertion: 10000,
    markup: 15000,
    validation: 20000,
    operations: 15000,
    supports: 15000,
    variations: 15000,
    styles: 15000,
    keywords: 20000,
};
// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------
/**
 * Resolves the outer block's unique client ID from the editor iframe DOM.
 * Must use page.evaluate() for wp.data dispatches — window.wp is undefined
 * in the iframe (editor-canvas) context.
 */
async function getBlockClientId(page, blockName, timeout) {
    const editorFrame = page.frame({ name: 'editor-canvas' });
    if (!editorFrame) {
        throw new Error('Editor canvas frame not found — is wp-env running?');
    }
    const outerBlockEl = editorFrame.locator(`[data-type="${blockName}"]`).first();
    await outerBlockEl.waitFor({ state: 'visible', timeout });
    const blockClientId = await outerBlockEl.getAttribute('data-block');
    if (!blockClientId) {
        throw new Error(`data-block attribute not found on [data-type="${blockName}"]. ` +
            'The block may not have rendered correctly.');
    }
    return blockClientId;
}
/**
 * Asserts markup serialization for a single attribute based on its type and
 * whether the example value matches the block.json default.
 */
function assertMarkupAttribute(content, attrName, attrConfig, exampleValue) {
    const hasDefault = 'default' in attrConfig;
    const defaultVal = attrConfig.default;
    // WordPress omits attributes whose value equals the registered default.
    if (hasDefault && JSON.stringify(exampleValue) === JSON.stringify(defaultVal)) {
        (0, test_1.expect)(content, `"${attrName}" example value matches block.json default — WordPress omits it from markup`).not.toContain(`"${attrName}"`);
        return;
    }
    if (exampleValue === undefined) {
        (0, test_1.expect)(content).toContain(`"${attrName}"`);
        return;
    }
    switch (attrConfig.type) {
        case 'string':
            (0, test_1.expect)(content).toContain(`"${attrName}":"${exampleValue}"`);
            break;
        case 'boolean':
            (0, test_1.expect)(content).toContain(`"${attrName}":${exampleValue}`);
            break;
        case 'number':
        case 'integer':
            (0, test_1.expect)(content).toContain(`"${attrName}":${exampleValue}`);
            break;
        case 'array':
            (0, test_1.expect)(content).toContain(`"${attrName}":[`);
            break;
        case 'object':
            (0, test_1.expect)(content).toContain(`"${attrName}":{`);
            break;
        default:
            (0, test_1.expect)(content).toContain(`"${attrName}"`);
    }
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Registers the full suite of structural Playwright editor tests for a block.
 *
 * Tests registered:
 * - Insertion (visible in canvas)
 * - Visual rendering (no crash boundary)
 * - Markup serialization (wp comment delimiter)
 * - Example attribute serialization (if example.attributes provided)
 * - Validation (no errors after save + reload)
 * - Duplication (via wp.data store dispatch)
 * - Removal (via wp.data store dispatch)
 * - Block supports (color, typography, spacing, anchor, customClassName)
 * - Keywords (one test per keyword)
 * - Variations (one test per variation)
 * - Styles (one test per non-default style)
 *
 * @param test   - The test instance from @wordpress/e2e-test-utils-playwright
 * @param config - Block configuration derived from block.json
 */
function registerEditorTests(test, config) {
    const { blockName, title, attributes = {}, example = {}, supports = {}, keywords = [], variations = [], styles = [], } = config;
    const exampleAttributes = example.attributes || {};
    const hasExample = Object.keys(exampleAttributes).length > 0;
    const insertArgs = hasExample
        ? { name: blockName, attributes: exampleAttributes }
        : { name: blockName };
    const blockSelector = new RegExp(`Block: ${title}`, 'i');
    test.describe(`${title} - Editor`, () => {
        var _a, _b;
        let postId;
        test.afterEach(async ({ requestUtils }) => {
            if (postId) {
                await (0, helpers_1.deletePost)(requestUtils, postId);
                postId = undefined;
            }
        });
        // -----------------------------------------------------------------------
        // Insertion
        // -----------------------------------------------------------------------
        test('block can be inserted via the block inserter', async ({ admin, editor, page, requestUtils }) => {
            test.setTimeout(TIMEOUTS.insertion);
            postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
            await editor.insertBlock(insertArgs);
            // .first() handles container blocks — InnerBlocks renders a second
            // element with the same role/label for the inner block layout area.
            await (0, test_1.expect)(editor.canvas.getByRole('document', { name: blockSelector }).first()).toBeVisible();
        });
        test('block renders visibly in the editor canvas', async ({ admin, editor, page, requestUtils }) => {
            test.setTimeout(TIMEOUTS.insertion);
            postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
            await editor.insertBlock(insertArgs);
            const block = editor.canvas.getByRole('document', { name: blockSelector }).first();
            await (0, test_1.expect)(block).toBeVisible();
            // Fail fast if the block crashed — misleading errors follow otherwise.
            await (0, test_1.expect)(editor.canvas.getByText(/This block has encountered an error/i)).not.toBeVisible();
            const innerHTML = await block.evaluate((el) => el.innerHTML.trim());
            (0, test_1.expect)(innerHTML).not.toBe('');
        });
        // -----------------------------------------------------------------------
        // Serialized markup
        // -----------------------------------------------------------------------
        test('block serializes with the correct wp comment delimiter', async ({ admin, editor, page, requestUtils }) => {
            test.setTimeout(TIMEOUTS.markup);
            postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
            await editor.insertBlock(insertArgs);
            await editor.canvas
                .getByRole('document', { name: blockSelector })
                .first()
                .waitFor({ state: 'visible' });
            await (0, helpers_1.waitForEditorReady)(page);
            const content = await editor.getEditedPostContent();
            (0, test_1.expect)(content).toContain(`<!-- wp:${blockName}`);
        });
        if (hasExample) {
            test('block serializes example attributes into markup', async ({ admin, editor, page, requestUtils }) => {
                test.setTimeout(TIMEOUTS.markup);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                await editor.insertBlock(insertArgs);
                await editor.canvas
                    .getByRole('document', { name: blockSelector })
                    .first()
                    .waitFor({ state: 'visible' });
                await (0, helpers_1.waitForEditorReady)(page);
                const content = await editor.getEditedPostContent();
                for (const [key, value] of Object.entries(exampleAttributes)) {
                    assertMarkupAttribute(content, key, attributes[key] || {}, value);
                }
            });
        }
        // -----------------------------------------------------------------------
        // Validation
        // -----------------------------------------------------------------------
        test('block has no validation errors after save and reload', async ({ admin, editor, page, requestUtils }) => {
            test.setTimeout(TIMEOUTS.validation);
            postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
            await editor.insertBlock(insertArgs);
            await editor.canvas
                .getByRole('document', { name: blockSelector })
                .first()
                .waitFor({ state: 'visible' });
            await editor.publishPost();
            await page.reload();
            await page
                .getByRole('region', { name: /Editor top bar/i })
                .waitFor({ state: 'visible' });
            await (0, test_1.expect)(page.getByText('This block contains unexpected or invalid content')).not.toBeVisible();
        });
        // -----------------------------------------------------------------------
        // Block operations
        //
        // IMPORTANT: window.wp only exists on the PARENT page window, not in the
        // editor iframe. All wp.data dispatches use page.evaluate() (parent context).
        // editorFrame is used ONLY to read the data-block UUID from the DOM.
        // page.waitForFunction() verifies the store reflects the change before
        // asserting the DOM.
        // -----------------------------------------------------------------------
        test('block can be duplicated without errors', async ({ admin, editor, page, requestUtils }) => {
            test.setTimeout(TIMEOUTS.operations);
            postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
            await editor.insertBlock(insertArgs);
            await editor.canvas
                .getByRole('document', { name: blockSelector })
                .first()
                .waitFor({ state: 'visible' });
            const blockClientId = await getBlockClientId(page, blockName, TIMEOUTS.operations);
            await page.evaluate(async (clientId) => {
                await window.wp.data
                    .dispatch('core/block-editor')
                    .duplicateBlocks([clientId]);
            }, blockClientId);
            await page.waitForFunction(([blockType, expectedCount]) => {
                const flattenBlocks = (blocks) => blocks.flatMap((b) => { var _a; return [b, ...flattenBlocks((_a = b.innerBlocks) !== null && _a !== void 0 ? _a : [])]; });
                const all = flattenBlocks(window.wp.data.select('core/block-editor').getBlocks());
                return all.filter((b) => b.name === blockType).length >= expectedCount;
            }, [blockName, 2], { timeout: TIMEOUTS.operations });
        });
        test('block can be removed', async ({ admin, editor, page, requestUtils }) => {
            test.setTimeout(TIMEOUTS.operations);
            postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
            await editor.insertBlock(insertArgs);
            const block = editor.canvas
                .getByRole('document', { name: blockSelector })
                .first();
            await block.waitFor({ state: 'visible' });
            const blockClientId = await getBlockClientId(page, blockName, TIMEOUTS.operations);
            await page.evaluate(async (clientId) => {
                await window.wp.data
                    .dispatch('core/block-editor')
                    .removeBlock(clientId);
            }, blockClientId);
            await page.waitForFunction(([blockType]) => {
                const flattenBlocks = (blocks) => blocks.flatMap((b) => { var _a; return [b, ...flattenBlocks((_a = b.innerBlocks) !== null && _a !== void 0 ? _a : [])]; });
                const all = flattenBlocks(window.wp.data.select('core/block-editor').getBlocks());
                return all.filter((b) => b.name === blockType).length === 0;
            }, [blockName], { timeout: TIMEOUTS.operations });
            await (0, test_1.expect)(block).toHaveCount(0, { timeout: TIMEOUTS.operations });
        });
        // -----------------------------------------------------------------------
        // Block supports
        // -----------------------------------------------------------------------
        if (supports === null || supports === void 0 ? void 0 : supports.color) {
            test('supports: color panel is available in the inspector', async ({ admin, editor, page, requestUtils }) => {
                test.setTimeout(TIMEOUTS.supports);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                await editor.insertBlock(insertArgs);
                await editor.canvas.getByRole('document', { name: blockSelector }).first().waitFor({ state: 'visible' });
                await editor.canvas.getByRole('document', { name: blockSelector }).first().click();
                await (0, helpers_1.openInspectorSidebar)(editor, page);
                const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
                await settingsRegion.waitFor({ state: 'visible' });
                await (0, helpers_1.openStylesTab)(page);
                const colorOptions = settingsRegion.getByLabel('Color options');
                await colorOptions.waitFor({ state: 'visible' });
                await (0, test_1.expect)(colorOptions).toBeVisible();
            });
        }
        if (supports === null || supports === void 0 ? void 0 : supports.typography) {
            test('supports: typography panel is available in the inspector', async ({ admin, editor, page, requestUtils }) => {
                test.setTimeout(TIMEOUTS.supports);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                await editor.insertBlock(insertArgs);
                await editor.canvas.getByRole('document', { name: blockSelector }).first().waitFor({ state: 'visible' });
                await editor.canvas.getByRole('document', { name: blockSelector }).first().click();
                await (0, helpers_1.openInspectorSidebar)(editor, page);
                const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
                await settingsRegion.waitFor({ state: 'visible' });
                await (0, helpers_1.openStylesTab)(page);
                const typography = settingsRegion.getByLabel('Typography options');
                await typography.waitFor({ state: 'visible' });
                await (0, test_1.expect)(typography).toBeVisible();
            });
        }
        if (supports === null || supports === void 0 ? void 0 : supports.spacing) {
            test('supports: dimensions panel is available in the inspector', async ({ admin, editor, page, requestUtils }) => {
                test.setTimeout(TIMEOUTS.supports);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                await editor.insertBlock(insertArgs);
                await editor.canvas.getByRole('document', { name: blockSelector }).first().waitFor({ state: 'visible' });
                await editor.canvas.getByRole('document', { name: blockSelector }).first().click();
                await (0, helpers_1.openInspectorSidebar)(editor, page);
                const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
                await settingsRegion.waitFor({ state: 'visible' });
                await (0, helpers_1.openStylesTab)(page);
                const dimensions = settingsRegion.getByLabel('Dimensions options');
                await dimensions.waitFor({ state: 'visible' });
                await (0, test_1.expect)(dimensions).toBeVisible();
            });
        }
        if (supports === null || supports === void 0 ? void 0 : supports.anchor) {
            test('supports: HTML anchor field is available in advanced settings', async ({ admin, editor, page, requestUtils }) => {
                test.setTimeout(TIMEOUTS.supports);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                await editor.insertBlock(insertArgs);
                await editor.canvas.getByRole('document', { name: blockSelector }).first().waitFor({ state: 'visible' });
                await editor.canvas.getByRole('document', { name: blockSelector }).first().click();
                await (0, helpers_1.openInspectorSidebar)(editor, page);
                const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
                await settingsRegion.waitFor({ state: 'visible' });
                const settingsTab = settingsRegion.getByRole('tab', { name: /^Settings$/i });
                if (await settingsTab.isVisible())
                    await settingsTab.click();
                const advancedButton = settingsRegion.getByRole('button', { name: /^Advanced$/i });
                await advancedButton.waitFor({ state: 'visible' });
                await advancedButton.scrollIntoViewIfNeeded();
                if (await advancedButton.getAttribute('aria-expanded') === 'false') {
                    await advancedButton.click();
                }
                const anchor = settingsRegion.getByLabel('HTML anchor');
                await anchor.waitFor({ state: 'visible' });
                await (0, test_1.expect)(anchor).toBeVisible();
            });
        }
        if ((supports === null || supports === void 0 ? void 0 : supports.customClassName) !== false) {
            test('supports: additional CSS class is serialized in block markup', async ({ admin, editor, page, requestUtils }) => {
                test.setTimeout(TIMEOUTS.supports);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                await editor.insertBlock(insertArgs);
                await editor.canvas.getByRole('document', { name: blockSelector }).first().waitFor({ state: 'visible' });
                await editor.canvas.getByRole('document', { name: blockSelector }).first().click();
                await (0, helpers_1.openInspectorSidebar)(editor, page);
                const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
                await settingsRegion.waitFor({ state: 'visible' });
                const settingsTab = settingsRegion.getByRole('tab', { name: /^Settings$/i });
                if (await settingsTab.isVisible())
                    await settingsTab.click();
                const advancedButton = settingsRegion.getByRole('button', { name: /^Advanced$/i });
                await advancedButton.waitFor({ state: 'visible' });
                await advancedButton.scrollIntoViewIfNeeded();
                if (await advancedButton.getAttribute('aria-expanded') === 'false') {
                    await advancedButton.click();
                }
                const cssClassInput = settingsRegion.getByLabel('Additional CSS class(es)');
                await cssClassInput.waitFor({ state: 'visible' });
                await cssClassInput.fill('my-custom-class');
                await (0, helpers_1.waitForEditorReady)(page);
                const content = await editor.getEditedPostContent();
                (0, test_1.expect)(content).toContain('my-custom-class');
            });
        }
        // -----------------------------------------------------------------------
        // Keywords
        // -----------------------------------------------------------------------
        for (const keyword of keywords) {
            test(`keyword: "${keyword}" finds the block in the inserter`, async ({ admin, editor, page, requestUtils }) => {
                test.setTimeout(TIMEOUTS.keywords);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                const editorTopBar = page.getByRole('region', { name: /Editor top bar/i });
                const inserterButton = editorTopBar.getByLabel(/Toggle block inserter|Block Inserter/i);
                await inserterButton.waitFor({ state: 'visible' });
                await inserterButton.click();
                const searchInput = page.getByRole('searchbox', { name: /Search/i });
                await searchInput.waitFor({ state: 'visible' });
                await searchInput.fill(keyword);
                // exact: true prevents partial name matches
                await (0, test_1.expect)(page.getByRole('option', { name: title, exact: true })).toBeVisible();
            });
        }
        // -----------------------------------------------------------------------
        // Variations
        // -----------------------------------------------------------------------
        for (const variation of variations) {
            const variationAttributes = variation.attributes || {};
            const hasVarAttrs = Object.keys(variationAttributes).length > 0;
            const varInsertArgs = hasVarAttrs
                ? { name: blockName, attributes: variationAttributes }
                : { name: blockName };
            test(`variation: "${(_a = variation.title) !== null && _a !== void 0 ? _a : variation.name}" inserts and serializes correctly`, async ({ admin, editor, page, requestUtils }) => {
                test.setTimeout(TIMEOUTS.variations);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                await editor.insertBlock(varInsertArgs);
                await editor.canvas
                    .getByRole('document', { name: blockSelector })
                    .first()
                    .waitFor({ state: 'visible' });
                await (0, helpers_1.waitForEditorReady)(page);
                const content = await editor.getEditedPostContent();
                if (hasVarAttrs) {
                    for (const [key, value] of Object.entries(variationAttributes)) {
                        assertMarkupAttribute(content, key, attributes[key] || {}, value);
                    }
                }
                else {
                    (0, test_1.expect)(content).toContain(`<!-- wp:${blockName}`);
                }
            });
        }
        // -----------------------------------------------------------------------
        // Styles
        // -----------------------------------------------------------------------
        for (const style of styles.filter((s) => !s.isDefault)) {
            test(`style: "${(_b = style.label) !== null && _b !== void 0 ? _b : style.name}" applies correct class to block markup`, async ({ admin, editor, page, requestUtils }) => {
                var _a;
                test.setTimeout(TIMEOUTS.styles);
                postId = await (0, helpers_1.createPostAndGetId)(admin, page, requestUtils);
                await editor.insertBlock(insertArgs);
                await editor.canvas
                    .getByRole('document', { name: blockSelector })
                    .first()
                    .waitFor({ state: 'visible' });
                await editor.canvas.getByRole('document', { name: blockSelector }).first().click();
                await (0, helpers_1.openInspectorSidebar)(editor, page);
                await (0, helpers_1.openStylesTab)(page);
                const styleButton = page.getByRole('button', { name: (_a = style.label) !== null && _a !== void 0 ? _a : style.name });
                await styleButton.waitFor({ state: 'visible' });
                await styleButton.click();
                await (0, helpers_1.waitForEditorReady)(page);
                const content = await editor.getEditedPostContent();
                (0, test_1.expect)(content).toContain(`is-style-${style.name}`);
            });
        }
    });
}
// ---------------------------------------------------------------------------
// Discovery-based registration
// ---------------------------------------------------------------------------
/**
 * Reads `wp-env-bin.e2e.config.json`, loads each block.json listed under
 * `"editor"`, and registers the full editor test suite for each block.
 *
 * No spec files need to be regenerated when block.json changes — tests
 * reflect the current state of the source on every run.
 *
 * @param test       - The test instance from @wordpress/e2e-test-utils-playwright
 * @param configPath - Absolute path to wp-env-bin.e2e.config.json.
 *                     Use path.join(__dirname, '../../wp-env-bin.e2e.config.json')
 *                     from within a spec file.
 *
 * @example
 * // specs/editor/blocks.spec.ts
 * import { test } from '@wordpress/e2e-test-utils-playwright';
 * import { registerEditorTestsFromConfig } from '@e2e/utils/editor-tests';
 * import * as path from 'path';
 * registerEditorTestsFromConfig(test, path.join(__dirname, '../../wp-env-bin.e2e.config.json'));
 */
function registerEditorTestsFromConfig(test, configPath) {
    var _a;
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(configPath)) {
        throw new Error(`[wp-env-bin] Config file not found: ${configPath}\n` +
            'Run "wp-env-bin e2e scaffold" to create it, then add block directories to the "editor" array.');
    }
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const root = path.resolve(path.dirname(configPath), '../..');
    for (const dir of ((_a = cfg.editor) !== null && _a !== void 0 ? _a : [])) {
        const blockJsonPath = path.resolve(root, dir, 'block.json');
        if (!fs.existsSync(blockJsonPath)) {
            console.warn(`[wp-env-bin] block.json not found at ${blockJsonPath} — skipping`);
            continue;
        }
        registerEditorTests(test, (0, block_loader_1.loadEditorConfig)(blockJsonPath));
    }
}
