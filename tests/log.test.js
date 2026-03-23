"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { logger } = require("../lib/utils/log");

test("logger returns the string when log is false", () => {
	const result = logger("hello world", false);
	assert.equal(result, "hello world");
});

test("logger returns undefined when log is true (default)", () => {
	const result = logger("hello", true);
	assert.equal(result, undefined);
});

test("logger returns undefined with no second argument (defaults to log=true)", () => {
	const result = logger("hello");
	assert.equal(result, undefined);
});
