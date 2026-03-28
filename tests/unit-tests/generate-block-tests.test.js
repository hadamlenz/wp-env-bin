import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGenerateArgs } from "../../commands/e2e.js";
import { generateTestFile } from "../../lib/e2e/generate-block-tests.mjs";

// --- parseGenerateArgs ---

test("parseGenerateArgs returns correct defaults for editor", () => {
	const result = parseGenerateArgs([], "editor");
	assert.deepEqual(result, {
		files: [],
		output: "./wp-env-bin/e2e/specs/editor",
		glob: null,
		help: false,
	});
});

test("parseGenerateArgs returns correct defaults for frontend", () => {
	const result = parseGenerateArgs([], "frontend");
	assert.deepEqual(result, {
		files: [],
		output: "./wp-env-bin/e2e/specs/frontend",
		glob: null,
		help: false,
		screenshots: false,
		visualRegression: false,
	});
});

test("parseGenerateArgs --file= pushes to files array", () => {
	const result = parseGenerateArgs(["--file=src/block.json"], "editor");
	assert.deepEqual(result.files, ["src/block.json"]);
});

test("parseGenerateArgs multiple --file= args accumulate", () => {
	const result = parseGenerateArgs(["--file=a/block.json", "--file=b/block.json"], "editor");
	assert.deepEqual(result.files, ["a/block.json", "b/block.json"]);
});

test("parseGenerateArgs --output= sets output", () => {
	const result = parseGenerateArgs(["--output=custom/dir"], "editor");
	assert.equal(result.output, "custom/dir");
});

test("parseGenerateArgs --glob= sets glob", () => {
	const result = parseGenerateArgs(["--glob=src/**/block.json"], "editor");
	assert.equal(result.glob, "src/**/block.json");
});

test("parseGenerateArgs --help sets help to true", () => {
	const result = parseGenerateArgs(["--help"], "editor");
	assert.equal(result.help, true);
});

test("parseGenerateArgs -h sets help to true", () => {
	const result = parseGenerateArgs(["-h"], "editor");
	assert.equal(result.help, true);
});

test("parseGenerateArgs --screenshots sets screenshots for frontend", () => {
	const result = parseGenerateArgs(["--screenshots"], "frontend");
	assert.equal(result.screenshots, true);
});

test("parseGenerateArgs --visual-regression sets visualRegression for frontend", () => {
	const result = parseGenerateArgs(["--visual-regression"], "frontend");
	assert.equal(result.visualRegression, true);
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
