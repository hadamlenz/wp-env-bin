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
import type { EditorTestConfig } from './types.js';
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
export declare function registerEditorTests(test: any, config: EditorTestConfig): void;
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
export declare function registerEditorTestsFromConfig(test: any, configPath: string): void;
