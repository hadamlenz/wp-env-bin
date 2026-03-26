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

test("logger returns an empty string when passed an empty string with log false", () => {
	assert.equal(logger("", false), "");
});

test("logger returns a multi-line string unchanged when log is false", () => {
	const msg = "line one\nline two\nline three";
	assert.equal(logger(msg, false), msg);
});

test("logger calls console.log with the exact message when log is true", () => {
	const calls = [];
	const original = console.log;
	console.log = (msg) => calls.push(msg);
	logger("test message");
	console.log = original;
	assert.equal(calls.length, 1);
	assert.equal(calls[0], "test message");
});
