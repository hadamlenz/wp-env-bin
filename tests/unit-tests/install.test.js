import { test } from "node:test";
import assert from "assert/strict";
import { applyProjectType } from "../../lib/config.js";

// --- applyProjectType ---

test("applyProjectType: theme sets themes and removes plugins", () => {
	const input = { plugins: [".."], env: {} };
	const result = applyProjectType(input, "theme");
	assert.deepEqual(result.themes, [".."]);
	assert.equal("plugins" in result, false);
});

test("applyProjectType: plugin sets plugins and removes themes", () => {
	const input = { themes: [".."], env: {} };
	const result = applyProjectType(input, "plugin");
	assert.deepEqual(result.plugins, [".."]);
	assert.equal("themes" in result, false);
});

test("applyProjectType: theme when no existing plugins key does not error", () => {
	const input = { env: {} };
	const result = applyProjectType(input, "theme");
	assert.deepEqual(result.themes, [".."]);
	assert.equal("plugins" in result, false);
});

test("applyProjectType: plugin when no existing themes key does not error", () => {
	const input = { env: {} };
	const result = applyProjectType(input, "plugin");
	assert.deepEqual(result.plugins, [".."]);
	assert.equal("themes" in result, false);
});

test("applyProjectType: preserves other keys", () => {
	const input = { env: { development: { port: 8889 } }, mappings: {} };
	const result = applyProjectType(input, "theme");
	assert.deepEqual(result.env, input.env);
	assert.deepEqual(result.mappings, input.mappings);
});

test("applyProjectType: does not mutate the original object", () => {
	const input = { plugins: [".."] };
	applyProjectType(input, "theme");
	assert.deepEqual(input.plugins, [".."]);
	assert.equal("themes" in input, false);
});
