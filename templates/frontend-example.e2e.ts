import { test, expect } from '@wordpress/e2e-test-utils-playwright';
import { deletePost, serializeBlock } from '@e2e/utils/helpers';
import json from '../block.json';

test.describe(`${json.title} - Front End (Post Context)`, () => {
	let postId: number | undefined;

	test.afterEach(async ({ requestUtils }) => {
		if (postId) {
			await deletePost(requestUtils, postId);
			postId = undefined;
		}
	});

	test(`${json.title} - Frontend > TODO: Add a descrition of this test`, async ({ page, requestUtils }) => {
		test.setTimeout(20_000);

		const post = await requestUtils.createPost({
			title:   `${json.title} Frontend Test`,
			content: serializeBlock({ name: json.name, attributes: json.example.attributes, innerBlocks: json.example.innerBlocks }),
			status:  'publish',
		} as any);
		postId = post.id;

		await page.goto(`/?p=${post.id}`);
		await page.waitForLoadState('domcontentloaded');
        //... add assertions here
    });
});