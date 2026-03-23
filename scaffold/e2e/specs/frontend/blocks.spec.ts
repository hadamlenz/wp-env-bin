import { test } from '@wordpress/e2e-test-utils-playwright';
import { registerFrontendTestsFromConfig } from '@e2e/utils/frontend-tests';
import * as path from 'path';

// Discovery-based frontend tests — block CSS and render.php are read at test
// startup, so no regeneration is needed when block.json or styles change.
// Add block directories to wp-env-bin.e2e.config.json to include them here.
// Run a specific block: npx playwright test --project=all-blocks-frontend --grep "Block Title"

registerFrontendTestsFromConfig(test, path.join(__dirname, '../../wp-env-bin.e2e.config.json'), {
  screenshots: true,
});
