"use strict";
/**
 * @file helpers.ts
 * @description Shared Playwright helper functions for WordPress block editor tests.
 * Used by generated structural test files and block-specific *.e2e.ts files.
 *
 * @example <caption>Import in a generated spec or block-specific e2e file</caption>
 * import {
 *   createPostAndGetId,
 *   waitForEditorReady,
 *   deletePost,
 *   openInspectorSidebar,
 *   openStylesTab,
 *   expandPanel,
 * } from '@e2e/utils/helpers';
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPostAndGetId = createPostAndGetId;
exports.deletePost = deletePost;
exports.waitForEditorReady = waitForEditorReady;
exports.openInspectorSidebar = openInspectorSidebar;
exports.openStylesTab = openStylesTab;
exports.serializeBlock = serializeBlock;
exports.expandPanel = expandPanel;
// ---------------------------------------------------------------------------
// Post management
// ---------------------------------------------------------------------------
/**
 * Creates a draft post via the REST API and opens it in the block editor.
 *
 * Using requestUtils.createPost() guarantees the post ID is available
 * immediately — no waiting for auto-draft saves or URL changes.
 * admin.editPost() then navigates directly to that post's editor URL.
 *
 * Uses a type assertion on the payload because the CreatePostPayload type
 * marks date_gmt as required but the WordPress REST API does not require it.
 *
 * @param admin        - Admin fixture from @wordpress/e2e-test-utils-playwright
 * @param page         - Playwright Page
 * @param requestUtils - RequestUtils fixture from @wordpress/e2e-test-utils-playwright
 * @returns            - The created post ID
 */
async function createPostAndGetId(admin, page, requestUtils) {
    const post = await requestUtils.createPost({
        title: 'Test Post',
        status: 'draft',
    });
    await admin.editPost(post.id);
    // Wait for the editor toolbar to confirm the editor has fully mounted.
    // This region is stable across all WordPress versions.
    await page
        .getByRole('region', { name: /Editor top bar/i })
        .waitFor({ state: 'visible' });
    return post.id;
}
/**
 * Permanently deletes a post via the REST API.
 *
 * Uses force=true to bypass the trash and prevent posts accumulating
 * across test runs. Safe to call in afterEach — swallows errors if the
 * post was already deleted or the browser context was torn down before
 * cleanup ran.
 *
 * @param requestUtils - RequestUtils fixture
 * @param postId       - ID of the post to delete
 */
async function deletePost(requestUtils, postId) {
    try {
        await requestUtils.rest({
            method: 'DELETE',
            path: `/wp/v2/posts/${postId}`,
            params: { force: true },
        });
    }
    catch (error) {
        console.warn(`⚠️  Could not delete post ${postId}: ${error.message}`);
    }
}
// ---------------------------------------------------------------------------
// Editor state
// ---------------------------------------------------------------------------
/**
 * Waits for the block editor to finish any in-progress saves or autosaves.
 *
 * More reliable than page.waitForLoadState('networkidle') in the WordPress
 * editor because the heartbeat API and autosave keep the network permanently
 * active.
 *
 * @param page    - Playwright Page
 * @param timeout - Maximum wait time in ms (default: 10_000)
 */
async function waitForEditorReady(page, timeout = 10000) {
    await page.waitForFunction(() => {
        var _a, _b;
        const editor = (_b = (_a = window.wp) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.select('core/editor');
        if (!editor)
            return true;
        return !editor.isSavingPost() && !editor.isAutosavingPost();
    }, { timeout });
}
// ---------------------------------------------------------------------------
// Inspector panel helpers
// ---------------------------------------------------------------------------
/**
 * Opens the block inspector sidebar and waits for it to be fully visible.
 *
 * @param editor - Editor fixture from @wordpress/e2e-test-utils-playwright
 * @param page   - Playwright Page
 */
async function openInspectorSidebar(editor, page) {
    await editor.openDocumentSettingsSidebar();
    await page
        .getByRole('region', { name: /Editor settings/i })
        .waitFor({ state: 'visible' });
}
/**
 * Clicks the Styles tab in the block inspector sidebar and waits for it
 * to become active. Required before accessing Color, Typography, or
 * Dimensions panels which live under the Styles tab.
 *
 * Uses getByLabel rather than getByRole because the Styles tab is an
 * SVG icon button with an aria-label and no visible text content.
 *
 * @param page - Playwright Page
 */
async function openStylesTab(page) {
    const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
    const stylesTab = settingsRegion.getByLabel('Styles');
    await stylesTab.waitFor({ state: 'visible' });
    await stylesTab.click();
}
/**
 * Serializes a block (and its inner blocks) into WordPress block comment syntax.
 *
 * Handles both self-closing blocks (no innerBlocks) and blocks with children.
 * Pass the `example` object from block.json directly, or construct manually.
 *
 * @param block - Block descriptor with name, optional attributes, and optional innerBlocks
 * @returns      Serialized WordPress block markup string
 *
 * @example
 * const content = serializeBlock({
 *   name:        json.name,
 *   attributes:  json.example.attributes,
 *   innerBlocks: json.example.innerBlocks,
 * });
 */
function serializeBlock(block) {
    const attrs = block.attributes && Object.keys(block.attributes).length > 0
        ? ` ${JSON.stringify(block.attributes)}`
        : '';
    if (!block.innerBlocks || block.innerBlocks.length === 0) {
        return `<!-- wp:${block.name}${attrs} /-->`;
    }
    const innerContent = block.innerBlocks.map(serializeBlock).join('\n');
    return `<!-- wp:${block.name}${attrs} -->\n${innerContent}\n<!-- /wp:${block.name} -->`;
}
async function expandPanel(page, sectionLabel) {
    const section = page.getByRole('button', { name: sectionLabel });
    await section.waitFor({ state: 'visible' });
    if (await section.getAttribute('aria-expanded') === 'false') {
        await section.click();
        await section.waitFor({ state: 'visible' });
    }
}
