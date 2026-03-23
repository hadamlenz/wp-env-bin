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

import type { Admin, RequestUtils } from '@wordpress/e2e-test-utils-playwright';
import type { Page } from '@playwright/test';

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
export async function createPostAndGetId(
  admin:        Admin,
  page:         Page,
  requestUtils: RequestUtils,
): Promise<number> {
  const post = await requestUtils.createPost({
    title:  'Test Post',
    status: 'draft',
  } as any);

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
export async function deletePost(
  requestUtils: RequestUtils,
  postId:       number,
): Promise<void> {
  try {
    await requestUtils.rest({
      method: 'DELETE',
      path:   `/wp/v2/posts/${postId}`,
      params: { force: true },
    });
  } catch (error) {
    console.warn(`⚠️  Could not delete post ${postId}: ${(error as Error).message}`);
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
export async function waitForEditorReady(
  page:    Page,
  timeout: number = 10_000,
): Promise<void> {
  await page.waitForFunction(
    () => {
      const editor = (window as any).wp?.data?.select('core/editor');
      if (!editor) return true;
      return !editor.isSavingPost() && !editor.isAutosavingPost();
    },
    { timeout }
  );
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
export async function openInspectorSidebar(
  editor: any,
  page:   Page,
): Promise<void> {
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
export async function openStylesTab(page: Page): Promise<void> {
  const settingsRegion = page.getByRole('region', { name: /Editor settings/i });
  const stylesTab      = settingsRegion.getByLabel('Styles');
  await stylesTab.waitFor({ state: 'visible' });
  await stylesTab.click();
}

/**
 * Expands a collapsed PanelBody section in the inspector sidebar and waits
 * for it to confirm it is open before returning.
 *
 * @param page         - Playwright Page
 * @param sectionLabel - The visible label of the PanelBody button
 */
// ---------------------------------------------------------------------------
// Block serialization
// ---------------------------------------------------------------------------

type BlockDescriptor = {
  name:        string;
  attributes?: Record<string, unknown>;
  innerBlocks?: BlockDescriptor[];
};

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
export function serializeBlock(block: BlockDescriptor): string {
  const attrs = block.attributes && Object.keys(block.attributes).length > 0
    ? ` ${JSON.stringify(block.attributes)}`
    : '';

  if (!block.innerBlocks || block.innerBlocks.length === 0) {
    return `<!-- wp:${block.name}${attrs} /-->`;
  }

  const innerContent = block.innerBlocks.map(serializeBlock).join('\n');
  return `<!-- wp:${block.name}${attrs} -->\n${innerContent}\n<!-- /wp:${block.name} -->`;
}

export async function expandPanel(
  page:         Page,
  sectionLabel: string,
): Promise<void> {
  const section = page.getByRole('button', { name: sectionLabel });
  await section.waitFor({ state: 'visible' });
  if (await section.getAttribute('aria-expanded') === 'false') {
    await section.click();
    await section.waitFor({ state: 'visible' });
  }
}