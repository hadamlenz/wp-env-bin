import { test } from '@wordpress/e2e-test-utils-playwright';
import { registerEditorTestsFromConfig } from '../../editor-tests';
import * as path from 'path';

// Discovery-based editor tests — no regeneration needed when block.json changes.
// Add block directories to wp-env-bin.e2e.config.json to include them here.
// Run a specific block: npx playwright test --project=all-blocks-editor --grep "Block Title"

registerEditorTestsFromConfig(test, path.join(process.cwd(), 'wp-env-bin.e2e.config.json'));
