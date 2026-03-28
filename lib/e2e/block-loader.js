"use strict";
/**
 * @file block-loader.ts
 * @description Loads block.json + render.php and produces EditorTestConfig / FrontendTestConfig.
 *
 * Used by registerEditorTestsFromConfig() and registerFrontendTestsFromConfig()
 * for discovery-based test registration, and by the generate scripts for
 * static spec file generation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeAttributesForApi = sanitizeAttributesForApi;
exports.resolveBlockCss = resolveBlockCss;
exports.analyseRenderPhp = analyseRenderPhp;
exports.buildContentAssertions = buildContentAssertions;
exports.loadEditorConfig = loadEditorConfig;
exports.loadFrontendConfig = loadFrontendConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ---------------------------------------------------------------------------
// API attribute sanitization
// ---------------------------------------------------------------------------
/**
 * Removes attributes whose schema declares "type": "null".
 * The Block Renderer REST API rejects null-typed attributes with 400 rest_invalid_param.
 */
function sanitizeAttributesForApi(exampleAttributes, blockAttributes) {
    if (!exampleAttributes || !blockAttributes)
        return exampleAttributes || {};
    return Object.fromEntries(Object.entries(exampleAttributes).filter(([key]) => blockAttributes[key]?.type !== 'null'));
}
// ---------------------------------------------------------------------------
// Block CSS resolution
// ---------------------------------------------------------------------------
/**
 * Attempts to resolve and read the block's built CSS from block.json `style`
 * or `editorStyle` entries that begin with `file:`.
 * Returns the CSS string if found, null otherwise.
 */
function resolveBlockCss(blockJsonPath, blockJson) {
    const candidates = []
        .concat(blockJson.style ?? [])
        .concat(blockJson.editorStyle ?? [])
        .filter(Boolean);
    for (const field of candidates) {
        if (typeof field !== 'string' || !field.startsWith('file:'))
            continue;
        const cssPath = path_1.default.resolve(path_1.default.dirname(blockJsonPath), field.replace(/^file:/, ''));
        if (fs_1.default.existsSync(cssPath)) {
            try {
                return fs_1.default.readFileSync(cssPath, 'utf8');
            }
            catch {
                // try next candidate
            }
        }
    }
    return null;
}
/**
 * Reads and analyses the render.php file adjacent to block.json.
 * Uses exec() loops for ES2019 compatibility.
 */
function analyseRenderPhp(blockJsonPath, blockJson) {
    const result = {
        found: false,
        path: null,
        isDynamic: false,
        usesWrapperAttrs: false,
        ariaAttributes: [],
        htmlElements: [],
        attributesUsed: [],
        attributesIssetGuarded: [],
        hasInteractivity: false,
        renderFieldInJson: null,
    };
    if (typeof blockJson.render === 'string') {
        result.renderFieldInJson = blockJson.render;
        result.isDynamic = true;
        result.path = path_1.default.resolve(path_1.default.dirname(blockJsonPath), blockJson.render.replace(/^file:/, ''));
    }
    if (!result.path) {
        const candidate = path_1.default.resolve(path_1.default.dirname(blockJsonPath), 'render.php');
        if (fs_1.default.existsSync(candidate)) {
            result.path = candidate;
            result.isDynamic = true;
        }
    }
    if (!result.path || !fs_1.default.existsSync(result.path))
        return result;
    result.found = true;
    let php = '';
    try {
        php = fs_1.default.readFileSync(result.path, 'utf8');
    }
    catch {
        return result;
    }
    result.usesWrapperAttrs = /get_block_wrapper_attributes/.test(php);
    result.hasInteractivity = /wp-interactivity|data-wp-/.test(php);
    // Collect unique aria-* attribute names
    const ariaSet = new Set();
    const ariaRe = /aria-([a-z-]+)/g;
    let m;
    while ((m = ariaRe.exec(php)) !== null)
        ariaSet.add(`aria-${m[1]}`);
    result.ariaAttributes = [...ariaSet];
    // Collect unique interactive HTML element tag names
    const elSet = new Set();
    const elRe = /<(a|button|img|input|select|textarea|video|audio|iframe|svg|canvas|dialog|details|summary)\b/gi;
    while ((m = elRe.exec(php)) !== null)
        elSet.add(m[1].toLowerCase());
    result.htmlElements = [...elSet];
    // Collect unique $attributes['key'] usages
    const attrSet = new Set();
    const attrRe = /\$attributes\[['"]([^'"]+)['"]\]/g;
    while ((m = attrRe.exec(php)) !== null)
        attrSet.add(m[1]);
    result.attributesUsed = [...attrSet];
    // Collect attributes guarded by isset() inside if() — unreliable to assert
    const issetSet = new Set();
    const issetRe = /\bif\s*\([^)]*isset\s*\(\s*\$attributes\[['"]([^'"]+)['"]\]\s*\)/g;
    while ((m = issetRe.exec(php)) !== null)
        issetSet.add(m[1]);
    result.attributesIssetGuarded = [...issetSet];
    return result;
}
// ---------------------------------------------------------------------------
// Content assertion building
// ---------------------------------------------------------------------------
const PALETTE_SLUG_RE = /^[a-z][a-z0-9-]+$/;
/**
 * Builds content assertions from render.php analysis and example attributes.
 * Only includes string-valued attributes that appear verbatim in rendered HTML.
 */
function buildContentAssertions(renderAnalysis, exampleAttributes) {
    const issetGuarded = new Set(renderAnalysis.attributesIssetGuarded);
    return renderAnalysis.attributesUsed
        .filter(key => {
        if (!(key in exampleAttributes))
            return false;
        const val = exampleAttributes[key];
        if (typeof val !== 'string' || !val.trim())
            return false;
        if (/color/i.test(key) && PALETTE_SLUG_RE.test(val.trim()))
            return false;
        if (issetGuarded.has(key))
            return false;
        return true;
    })
        .map(key => ({ key, value: exampleAttributes[key] }));
}
// ---------------------------------------------------------------------------
// Config loaders
// ---------------------------------------------------------------------------
/**
 * Loads an EditorTestConfig from a block.json file path.
 */
function loadEditorConfig(blockJsonPath) {
    const blockJson = JSON.parse(fs_1.default.readFileSync(blockJsonPath, 'utf8'));
    const blockName = blockJson.name;
    const title = blockJson.title || blockName;
    const attributes = blockJson.attributes || {};
    const supports = blockJson.supports || {};
    const keywords = blockJson.keywords || [];
    const variations = blockJson.variations || [];
    const styles = (blockJson.styles || []).filter((s) => !s.isDefault);
    const exampleAttributes = blockJson.example?.attributes || {};
    const example = Object.keys(exampleAttributes).length ? { attributes: exampleAttributes } : undefined;
    return {
        blockName,
        title,
        ...(example ? { example } : {}),
        ...(Object.keys(attributes).length ? { attributes } : {}),
        ...(Object.keys(supports).length ? { supports } : {}),
        ...(keywords.length ? { keywords } : {}),
        ...(variations.length ? { variations } : {}),
        ...(styles.length ? { styles } : {}),
    };
}
/**
 * Loads a FrontendTestConfig from a block.json file path.
 * Reads block CSS and analyses render.php synchronously at call time.
 */
function loadFrontendConfig(blockJsonPath, options = {}) {
    const blockJson = JSON.parse(fs_1.default.readFileSync(blockJsonPath, 'utf8'));
    const blockName = blockJson.name;
    const title = blockJson.title || blockName;
    const exampleAttributes = blockJson.example?.attributes || {};
    const apiAttributes = sanitizeAttributesForApi(exampleAttributes, blockJson.attributes || {});
    const renderAnalysis = analyseRenderPhp(blockJsonPath, blockJson);
    const blockCss = resolveBlockCss(blockJsonPath, blockJson);
    const contentAssertions = buildContentAssertions(renderAnalysis, exampleAttributes);
    return {
        blockName,
        title,
        apiAttributes,
        ...(renderAnalysis.htmlElements.length ? { htmlElements: renderAnalysis.htmlElements } : {}),
        ...(renderAnalysis.ariaAttributes.length ? { ariaAttributes: renderAnalysis.ariaAttributes } : {}),
        ...(contentAssertions.length ? { contentAssertions } : {}),
        ...(renderAnalysis.hasInteractivity ? { hasInteractiveDirectives: true } : {}),
        ...(blockCss ? { blockCss } : {}),
        ...(options.screenshots ? { screenshots: true } : {}),
        ...(options.visualRegression ? { visualRegression: true } : {}),
    };
}
