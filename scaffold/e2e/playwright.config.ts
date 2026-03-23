import { defineConfig, devices } from '@playwright/test';

// Force the correct base URL before @wordpress/e2e-test-utils-playwright reads
// process.env.WP_BASE_URL from its own config.js (defaults to 8889).
const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:8886';
process.env.WP_BASE_URL = BASE_URL;

const chromeSettings = { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } };

export default defineConfig({
	expect: { timeout: 5_000 },
	snapshotDir: './snapshots',
	snapshotPathTemplate: '{snapshotDir}/{testName}/{arg}{ext}',
	updateSnapshots: 'missing',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 1,
	reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
	testDir: './specs',
	timeout: 30_000,
	tsconfig: './tsconfig.e2e.json',
	workers: 1,

	use: {
		baseURL: BASE_URL,
		actionTimeout: 5_000,
		navigationTimeout: 15_000,
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
	},

	projects: [
		// Runs first — logs in as WordPress admin and saves session to specs/.auth/admin.json
		{
			name: 'setup',
			testMatch: 'specs/global.setup.ts',
			retries: 2,
		},

		// -----------------------------------------------------------------------
		// Editor tests — require authenticated admin session
		// Add one project per block, or use testMatch glob to run all at once.
		// -----------------------------------------------------------------------

		// Example: uncomment and rename to match your block slug after generating tests
		// {
		// 	name: 'my-block-editor',
		// 	use: {
		// 		...chromeSettings,
		// 		storageState: 'specs/.auth/admin.json',
		// 	},
		// 	testMatch: ['specs/editor/your-namespace-my-block.spec.ts'],
		// 	dependencies: ['setup'],
		// },

		// Convenience: run all editor specs at once (add after naming individual projects)
		{
			name: 'all-blocks-editor',
			use: {
				...chromeSettings,
				storageState: 'specs/.auth/admin.json',
			},
			// Picks up discovery spec + any hand-authored {block}/test/editor.e2e.ts files
			testMatch: ['specs/editor/**/*.spec.ts', '../../**/test/editor.e2e.ts'],
			dependencies: ['setup'],
		},

		// -----------------------------------------------------------------------
		// Frontend tests — unauthenticated, uses Block Renderer REST API
		// -----------------------------------------------------------------------

		// Example: uncomment and rename to match your block slug after generating tests
		// {
		// 	name: 'my-block-frontend',
		// 	use: { ...chromeSettings },
		// 	testMatch: ['specs/frontend/your-namespace-my-block.spec.ts'],
		// },

		// Convenience: run all frontend specs at once
		{
			name: 'all-blocks-frontend',
			use: { ...chromeSettings },
			// Picks up discovery spec + any hand-authored {block}/test/frontend.e2e.ts files
			testMatch: ['specs/frontend/**/*.spec.ts', '../../**/test/frontend.e2e.ts'],
		},
	],

	// wp-env is started via: cd e2e && npx wp-env start
	// Run that first, or add it as a webServer command below.
	//
	// webServer: {
	// 	command: 'npx wp-env start',
	// 	url: 'http://localhost:8886',
	// 	reuseExistingServer: true,
	// 	timeout: 120_000,
	// },
});
