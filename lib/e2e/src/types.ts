/**
 * @file types.ts
 * @description Shared TypeScript interfaces for registerEditorTests and registerFrontendTests.
 */

export interface AttributeSchema {
  type?: string;
  default?: unknown;
  enum?: unknown[];
}

export interface BlockVariation {
  name: string;
  title?: string;
  description?: string;
  attributes?: Record<string, unknown>;
}

export interface BlockStyle {
  name: string;
  label: string;
  isDefault?: boolean;
}

/**
 * Configuration passed to registerEditorTests().
 * All fields are derived from block.json at generation time.
 */
export interface EditorTestConfig {
  /** Registered block name, e.g. 'my-plugin/my-block' */
  blockName: string;
  /** Human-readable title from block.json */
  title: string;
  /** Attribute schemas from block.json, keyed by attribute name */
  attributes?: Record<string, AttributeSchema>;
  /** example field from block.json */
  example?: { attributes?: Record<string, unknown> };
  /** supports field from block.json */
  supports?: Record<string, unknown>;
  /** keywords array from block.json */
  keywords?: string[];
  /** variations array from block.json */
  variations?: BlockVariation[];
  /** styles array from block.json (non-default styles only) */
  styles?: BlockStyle[];
}

/**
 * Configuration passed to registerFrontendTests().
 * All fields are derived from block.json and render.php at generation time.
 */
export interface FrontendTestConfig {
  /** Registered block name, e.g. 'my-plugin/my-block' */
  blockName: string;
  /** Human-readable title from block.json */
  title: string;
  /** Attributes to send to the block renderer REST API (null-typed attrs removed) */
  apiAttributes: Record<string, unknown>;
  /** HTML element types found in render.php (e.g. ['img', 'a', 'svg']) */
  htmlElements?: string[];
  /** ARIA attribute names found in render.php (e.g. ['aria-label', 'aria-expanded']) */
  ariaAttributes?: string[];
  /** Attribute key/value pairs to assert appear in the rendered HTML */
  contentAssertions?: Array<{ key: string; value: string }>;
  /** Whether render.php contains data-wp-* interactivity directives */
  hasInteractiveDirectives?: boolean;
  /** Block CSS content to inject during tests, or null if not found */
  blockCss?: string | null;
  /** Whether to save dated PNG screenshots during test runs */
  screenshots?: boolean;
  /** Whether to generate toHaveScreenshot() visual regression assertions */
  visualRegression?: boolean;
}
