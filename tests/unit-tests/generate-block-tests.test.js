"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const ROOT  = path.join(__dirname, "../..");
const { parseArgs, generateTestFile } = require(path.join(ROOT, "lib/e2e/generate-block-tests"));

// --- parseArgs ---

test("parseArgs returns correct defaults", () => {
	const result = parseArgs([]);
	assert.deepEqual(result, {
		files: [],
		output: "./wp-env-bin/e2e/specs/editor",
		glob: null,
		help: false,
	});
});

test("parseArgs --file= pushes to files array", () => {
	const result = parseArgs(["--file=src/block.json"]);
	assert.deepEqual(result.files, ["src/block.json"]);
});

test("parseArgs multiple --file= args accumulate", () => {
	const result = parseArgs(["--file=a/block.json", "--file=b/block.json"]);
	assert.deepEqual(result.files, ["a/block.json", "b/block.json"]);
});

test("parseArgs --output= sets output", () => {
	const result = parseArgs(["--output=custom/dir"]);
	assert.equal(result.output, "custom/dir");
});

test("parseArgs --glob= sets glob", () => {
	const result = parseArgs(["--glob=src/**/block.json"]);
	assert.equal(result.glob, "src/**/block.json");
});

test("parseArgs --help sets help to true", () => {
	const result = parseArgs(["--help"]);
	assert.equal(result.help, true);
});

test("parseArgs -h sets help to true", () => {
	const result = parseArgs(["-h"]);
	assert.equal(result.help, true);
});

// --- generateTestFile ---

test("generateTestFile output contains registerEditorTests call", () => {
	const output = generateTestFile({ name: "my-plugin/test-block", title: "Test Block" });
	assert.ok(output.includes("registerEditorTests(test,"));
});

test("generateTestFile output contains the block name", () => {
	const output = generateTestFile({ name: "my-plugin/test-block" });
	assert.ok(output.includes("my-plugin/test-block"));
});

test("generateTestFile omits example key when no example.attributes", () => {
	const output = generateTestFile({ name: "my-plugin/test-block" });
	assert.ok(!output.includes('"example"'));
});

test("generateTestFile includes example.attributes when present", () => {
	const output = generateTestFile({
		name: "my-plugin/test-block",
		example: { attributes: { heading: "Hello" } },
	});
	assert.ok(output.includes('"example"'));
	assert.ok(output.includes('"heading"'));
});

test("generateTestFile omits empty attributes and supports", () => {
	const output = generateTestFile({ name: "my-plugin/test-block", attributes: {}, supports: {} });
	assert.ok(!output.includes('"attributes"'));
	assert.ok(!output.includes('"supports"'));
});

test("generateTestFile includes keywords when present", () => {
	const output = generateTestFile({ name: "my-plugin/test-block", keywords: ["hero", "banner"] });
	assert.ok(output.includes('"keywords"'));
	assert.ok(output.includes('"hero"'));
});

test("generateTestFile includes non-default styles when present", () => {
	const output = generateTestFile({
		name: "my-plugin/test-block",
		styles: [
			{ name: "default", label: "Default", isDefault: true },
			{ name: "outlined", label: "Outlined" },
		],
	});
	assert.ok(output.includes('"styles"'));
	assert.ok(output.includes('"outlined"'));
	assert.ok(!output.includes('"isDefault"'));
});
