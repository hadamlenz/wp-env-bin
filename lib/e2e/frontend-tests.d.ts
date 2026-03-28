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
import type { FrontendTestConfig } from './types.js';
import type { FrontendLoadOptions } from './block-loader.js';
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
export declare function registerFrontendTests(test: any, config: FrontendTestConfig): void;
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
export declare function registerFrontendTestsFromConfig(test: any, configPath: string, options?: FrontendLoadOptions): void;
