import { test } from '@wordpress/e2e-test-utils-playwright';
import { registerEditorTestsFromConfig } from '@e2e/utils/editor-tests';
import * as path from 'path';

// Managed by wp-env-bin — run `wp-env-bin e2e update` to refresh this file.
// Discovery-based: add block directories to wp-env-bin.e2e.config.json instead of regenerating.
// Run a specific block: npx playwright test --project=all-blocks-editor --grep "Block Title"

registerEditorTestsFromConfig(test, path.join(process.cwd(), 'wp-env-bin.e2e.config.json'));
