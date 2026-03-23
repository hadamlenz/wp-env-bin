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
import type { EditorTestConfig } from './types';
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
