"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const ROOT  = path.join(__dirname, "../..");
const {
	sanitizeAttributesForApi,
	buildContentAssertions,
	analyseRenderPhp,
	resolveBlockCss,
} = require(path.join(ROOT, "lib/e2e/block-loader"));

const FIXTURES = path.join(ROOT, "tests/fixtures");
const FULL_BLOCK_JSON = path.join(FIXTURES, "full.block.json");
const DYNAMIC_BLOCK_JSON = path.join(FIXTURES, "dynamic/block.json");

// --- sanitizeAttributesForApi ---

test("sanitizeAttributesForApi returns input unchanged when no null-typed attributes", () => {
	const attrs = { heading: "Hello", count: 5 };
	const schema = { heading: { type: "string" }, count: { type: "integer" } };
	assert.deepEqual(sanitizeAttributesForApi(attrs, schema), { heading: "Hello", count: 5 });
});

test("sanitizeAttributesForApi strips keys whose schema type is 'null'", () => {
	const attrs = { heading: "Hello", badAttr: null };
	const schema = { heading: { type: "string" }, badAttr: { type: "null" } };
	const result = sanitizeAttributesForApi(attrs, schema);
	assert.ok(!("badAttr" in result));
	assert.equal(result.heading, "Hello");
});

test("sanitizeAttributesForApi returns {} when exampleAttributes is null", () => {
	assert.deepEqual(sanitizeAttributesForApi(null, {}), {});
});

test("sanitizeAttributesForApi returns exampleAttributes when blockAttributes is null", () => {
	const attrs = { heading: "Hello" };
	assert.deepEqual(sanitizeAttributesForApi(attrs, null), attrs);
});

// --- buildContentAssertions ---

test("buildContentAssertions returns [] when attributesUsed is empty", () => {
	const analysis = { attributesUsed: [], attributesIssetGuarded: [] };
	const result = buildContentAssertions(analysis, { heading: "Hello" });
	assert.deepEqual(result, []);
});

test("buildContentAssertions includes non-empty string attribute found in exampleAttributes", () => {
	const analysis = { attributesUsed: ["heading"], attributesIssetGuarded: [] };
	const result = buildContentAssertions(analysis, { heading: "Hello World" });
	assert.deepEqual(result, [{ key: "heading", value: "Hello World" }]);
});

test("buildContentAssertions excludes key absent from exampleAttributes", () => {
	const analysis = { attributesUsed: ["missing"], attributesIssetGuarded: [] };
	const result = buildContentAssertions(analysis, { heading: "Hello" });
	assert.deepEqual(result, []);
});

test("buildContentAssertions excludes non-string attribute values", () => {
	const analysis = { attributesUsed: ["count", "flag"], attributesIssetGuarded: [] };
	const result = buildContentAssertions(analysis, { count: 42, flag: true });
	assert.deepEqual(result, []);
});

test("buildContentAssertions excludes empty string attributes", () => {
	const analysis = { attributesUsed: ["heading"], attributesIssetGuarded: [] };
	const result = buildContentAssertions(analysis, { heading: "" });
	assert.deepEqual(result, []);
});

test("buildContentAssertions excludes color palette slug values", () => {
	const analysis = { attributesUsed: ["colorSlug"], attributesIssetGuarded: [] };
	const result = buildContentAssertions(analysis, { colorSlug: "vivid-red" });
	assert.deepEqual(result, []);
});

test("buildContentAssertions excludes isset-guarded attributes", () => {
	const analysis = { attributesUsed: ["heading"], attributesIssetGuarded: ["heading"] };
	const result = buildContentAssertions(analysis, { heading: "Hello" });
	assert.deepEqual(result, []);
});

// --- analyseRenderPhp ---

test("analyseRenderPhp returns found:false when no render.php and no render field", () => {
	// Use a block.json with no render field and a path that has no render.php
	const result = analyseRenderPhp(FULL_BLOCK_JSON, { name: "my-plugin/full-block" });
	assert.equal(result.found, false);
	assert.equal(result.isDynamic, false);
});

test("analyseRenderPhp detects render field in block.json and marks isDynamic", () => {
	const dynamicJson = require(DYNAMIC_BLOCK_JSON);
	const result = analyseRenderPhp(DYNAMIC_BLOCK_JSON, dynamicJson);
	assert.equal(result.found, true);
	assert.equal(result.isDynamic, true);
});

test("analyseRenderPhp detects get_block_wrapper_attributes in render.php", () => {
	const dynamicJson = require(DYNAMIC_BLOCK_JSON);
	const result = analyseRenderPhp(DYNAMIC_BLOCK_JSON, dynamicJson);
	assert.equal(result.usesWrapperAttrs, true);
});

test("analyseRenderPhp detects wp-interactivity in render.php", () => {
	const dynamicJson = require(DYNAMIC_BLOCK_JSON);
	const result = analyseRenderPhp(DYNAMIC_BLOCK_JSON, dynamicJson);
	assert.equal(result.hasInteractivity, true);
});

test("analyseRenderPhp collects aria-* attribute names from render.php", () => {
	const dynamicJson = require(DYNAMIC_BLOCK_JSON);
	const result = analyseRenderPhp(DYNAMIC_BLOCK_JSON, dynamicJson);
	assert.ok(result.ariaAttributes.includes("aria-label"));
	assert.ok(result.ariaAttributes.includes("aria-pressed"));
});

test("analyseRenderPhp collects interactive HTML element names", () => {
	const dynamicJson = require(DYNAMIC_BLOCK_JSON);
	const result = analyseRenderPhp(DYNAMIC_BLOCK_JSON, dynamicJson);
	assert.ok(result.htmlElements.includes("button"));
	assert.ok(result.htmlElements.includes("img"));
});

test("analyseRenderPhp collects $attributes['key'] usages", () => {
	const dynamicJson = require(DYNAMIC_BLOCK_JSON);
	const result = analyseRenderPhp(DYNAMIC_BLOCK_JSON, dynamicJson);
	assert.ok(result.attributesUsed.includes("heading"));
	assert.ok(result.attributesUsed.includes("label"));
});

test("analyseRenderPhp detects isset-guarded attributes", () => {
	const dynamicJson = require(DYNAMIC_BLOCK_JSON);
	const result = analyseRenderPhp(DYNAMIC_BLOCK_JSON, dynamicJson);
	assert.ok(result.attributesIssetGuarded.includes("colorSlug"));
});

// --- resolveBlockCss ---

test("resolveBlockCss returns null when no style or editorStyle fields", () => {
	const result = resolveBlockCss(FULL_BLOCK_JSON, { name: "my-plugin/full-block" });
	assert.equal(result, null);
});

test("resolveBlockCss returns null when style does not start with file:", () => {
	const result = resolveBlockCss(FULL_BLOCK_JSON, { style: "my-plugin-style" });
	assert.equal(result, null);
});

test("resolveBlockCss returns null when referenced CSS file does not exist", () => {
	const result = resolveBlockCss(FULL_BLOCK_JSON, { style: "file:./nonexistent.css" });
	assert.equal(result, null);
});

test("resolveBlockCss returns CSS string when referenced file exists", () => {
	// Create a temporary CSS file next to the fixture block.json
	const { writeFileSync, rmSync } = require("fs");
	const cssPath = path.join(FIXTURES, "style.css");
	writeFileSync(cssPath, ".my-block { color: red; }", "utf8");
	try {
		const result = resolveBlockCss(FULL_BLOCK_JSON, { style: "file:./style.css" });
		assert.equal(result, ".my-block { color: red; }");
	} finally {
		rmSync(cssPath);
	}
});
