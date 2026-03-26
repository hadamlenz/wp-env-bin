/**
 * starting point for block specific e2e tests
 * copy this into the blocks's test director and start adding tests
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import {
	createPostAndGetId,
	waitForEditorReady,
	deletePost,
	openInspectorSidebar,
	openStylesTab,
	expandPanel,
} from '@e2e/utils/helpers';
import json from '../block.json';

test.describe(`${json.title} - Attribute Controls`, () => {
	let postId: number | undefined;

	test.afterEach(async ({ requestUtils }) => {
		if (postId && typeof postId === 'number') {
			await deletePost(requestUtils, postId);
			postId = undefined;
		}
	});

	test(`${json.title} - Editor > TODO: Add a descrition of this test`, async ({
		admin,
		editor,
		page,
		requestUtils,
	}) => {
		test.setTimeout(20_000);
        //make a new post
		postId = await createPostAndGetId(admin, page, requestUtils);
        //insert the block
		await editor.insertBlock({
			name: json.name,
			attributes: json.example.attributes,
		});
        //the block locator name
		const blockNameLocator = new RegExp(`Block: ${json.title}`, 'i');
        //the block
		const block = editor.canvas.getByRole('document', { name: blockNameLocator });
		//wait for block to appear
		await block.waitFor({ state: 'visible' });
		await openInspectorSidebar(editor, page);
		//... add assertions here
	});
});
