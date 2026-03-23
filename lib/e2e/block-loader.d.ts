/**
 * @file block-loader.ts
 * @description Loads block.json + render.php and produces EditorTestConfig / FrontendTestConfig.
 *
 * Used by registerEditorTestsFromConfig() and registerFrontendTestsFromConfig()
 * for discovery-based test registration, and by the generate scripts for
 * static spec file generation.
 */
import type { EditorTestConfig, FrontendTestConfig } from './types';
/**
 * Removes attributes whose schema declares "type": "null".
 * The Block Renderer REST API rejects null-typed attributes with 400 rest_invalid_param.
 */
export declare function sanitizeAttributesForApi(exampleAttributes: Record<string, unknown>, blockAttributes: Record<string, {
    type?: string;
}>): Record<string, unknown>;
/**
 * Attempts to resolve and read the block's built CSS from block.json `style`
 * or `editorStyle` entries that begin with `file:`.
 * Returns the CSS string if found, null otherwise.
 */
export declare function resolveBlockCss(blockJsonPath: string, blockJson: Record<string, unknown>): string | null;
export interface RenderPhpAnalysis {
    found: boolean;
    path: string | null;
    isDynamic: boolean;
    usesWrapperAttrs: boolean;
    ariaAttributes: string[];
    htmlElements: string[];
    attributesUsed: string[];
    attributesIssetGuarded: string[];
    hasInteractivity: boolean;
    renderFieldInJson: string | null;
}
/**
 * Reads and analyses the render.php file adjacent to block.json.
 * Uses exec() loops for ES2019 compatibility.
 */
export declare function analyseRenderPhp(blockJsonPath: string, blockJson: Record<string, unknown>): RenderPhpAnalysis;
/**
 * Builds content assertions from render.php analysis and example attributes.
 * Only includes string-valued attributes that appear verbatim in rendered HTML.
 */
export declare function buildContentAssertions(renderAnalysis: RenderPhpAnalysis, exampleAttributes: Record<string, unknown>): Array<{
    key: string;
    value: string;
}>;
/**
 * Loads an EditorTestConfig from a block.json file path.
 */
export declare function loadEditorConfig(blockJsonPath: string): EditorTestConfig;
export interface FrontendLoadOptions {
    screenshots?: boolean;
    visualRegression?: boolean;
}
/**
 * Loads a FrontendTestConfig from a block.json file path.
 * Reads block CSS and analyses render.php synchronously at call time.
 */
export declare function loadFrontendConfig(blockJsonPath: string, options?: FrontendLoadOptions): FrontendTestConfig;
