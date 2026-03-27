import { test } from '@wordpress/e2e-test-utils-playwright';
import { registerFrontendTestsFromConfig } from '@e2e/utils/frontend-tests';
import * as path from 'path';

// Managed by wp-env-bin — run `wp-env-bin e2e update` to refresh this file.
// Discovery-based: block CSS and render.php are read at test startup, no regeneration needed.
// Run a specific block: npx playwright test --project=all-blocks-frontend --grep "Block Title"

registerFrontendTestsFromConfig(test, path.join(process.cwd(), 'wp-env-bin.e2e.config.json'), {
	screenshots: true,
	visualRegression: true,
});
