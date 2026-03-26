"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { writeFileSync, mkdtempSync, rmSync } = require("fs");
const path = require("path");
const ROOT  = path.join(__dirname, "../..");
const os = require("os");
const { validateSqlFile } = require(path.join(ROOT, "lib/db"));

// Minimal valid WordPress mysqldump shared across tests
const VALID_DUMP = [
	"-- MySQL dump 10.13  Distrib 8.0.32, for Linux (x86_64)",
	"--",
	"-- Host: localhost    Database: wordpress",
	"--",
	"CREATE TABLE `wp_options` (",
	"  `option_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,",
	"  PRIMARY KEY (`option_id`)",
	") ENGINE=InnoDB;",
].join("\n");

let tmpDir;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-validate-edge-"));
});

after(() => {
	if (tmpDir) rmSync(tmpDir, { recursive: true });
});

function writeTmp(name, content) {
	const p = path.join(tmpDir, name);
	writeFileSync(p, content, "utf8");
	return p;
}

// --- missing CREATE TABLE ---

test("throws when file has no CREATE TABLE statement", () => {
	const noCreate = [
		"-- MySQL dump 10.13",
		"INSERT INTO `wp_options` VALUES (1, 'siteurl', 'http://example.com', 'yes');",
	].join("\n");
	const p = writeTmp("no-create.sql", noCreate);
	assert.throws(() => validateSqlFile(p), /CREATE TABLE/);
});

// --- missing _options table ---

test("throws when file has no WordPress _options table", () => {
	const noOptions = [
		"-- MySQL dump 10.13",
		"CREATE TABLE `unrelated_table` (`id` int);",
	].join("\n");
	const p = writeTmp("no-options.sql", noOptions);
	assert.throws(() => validateSqlFile(p), /options table/);
});

// --- zero-byte file ---

test("throws when file is 0 bytes", () => {
	const p = writeTmp("zero.sql", "");
	assert.throws(() => validateSqlFile(p), /empty/);
});

// --- data-only export (CREATE TABLE present but no structure) ---

test("throws when dump contains only INSERT statements and no schema", () => {
	const dataOnly = [
		"-- MySQL dump 10.13",
		"INSERT INTO `wp_options` VALUES (1, 'siteurl', 'http://example.com', 'yes');",
		"INSERT INTO `wp_options` VALUES (2, 'blogname', 'My Site', 'yes');",
	].join("\n");
	const p = writeTmp("data-only.sql", dataOnly);
	assert.throws(() => validateSqlFile(p), /CREATE TABLE/);
});

// --- happy path sanity check ---

test("does not throw for a minimal valid WordPress dump", () => {
	const p = writeTmp("valid-edge.sql", VALID_DUMP);
	assert.doesNotThrow(() => validateSqlFile(p));
});
