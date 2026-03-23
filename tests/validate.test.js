"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { writeFileSync, mkdtempSync, rmSync } = require("fs");
const path = require("path");
const os = require("os");
const { validateSqlFile } = require("../lib/db");

// Minimal valid WordPress mysqldump — has header, CREATE TABLE, and _options
const VALID_DUMP = [
	"-- MySQL dump 10.13  Distrib 8.0.32, for Linux (x86_64)",
	"--",
	"-- Host: localhost    Database: wordpress",
	"--",
	"CREATE TABLE `wp_options` (",
	"  `option_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,",
	"  `option_name` varchar(191) NOT NULL DEFAULT '',",
	"  PRIMARY KEY (`option_id`)",
	") ENGINE=InnoDB;",
].join("\n");

let tmpDir;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-test-"));
});

after(() => {
	if (tmpDir) rmSync(tmpDir, { recursive: true });
});

function writeTmp(name, content) {
	const p = path.join(tmpDir, name);
	writeFileSync(p, content, "utf8");
	return p;
}

// --- extension check ---

test("throws when file does not have .sql extension", () => {
	const p = writeTmp("dump.txt", VALID_DUMP);
	assert.throws(() => validateSqlFile(p), /\.sql extension/);
});

test("throws when file has no extension", () => {
	const p = writeTmp("dump", VALID_DUMP);
	assert.throws(() => validateSqlFile(p), /\.sql extension/);
});

// --- existence / size checks ---

test("throws when file does not exist", () => {
	assert.throws(
		() => validateSqlFile(path.join(tmpDir, "nonexistent.sql")),
		/File not found/
	);
});

test("throws when file is empty", () => {
	const p = writeTmp("empty.sql", "");
	assert.throws(() => validateSqlFile(p), /empty/);
});

// --- mysqldump header check ---

test("throws when mysqldump header is missing", () => {
	const p = writeTmp("noheader.sql", "CREATE TABLE `wp_options` (`id` int);");
	assert.throws(() => validateSqlFile(p), /mysqldump/);
});

test("accepts MariaDB dump header", () => {
	const mariadbDump = VALID_DUMP.replace("-- MySQL dump", "-- MariaDB dump");
	const p = writeTmp("mariadb.sql", mariadbDump);
	assert.doesNotThrow(() => validateSqlFile(p));
});

// --- CREATE TABLE check ---

test("throws when CREATE TABLE is absent (data-only export)", () => {
	const dataOnly = [
		"-- MySQL dump 10.13",
		"INSERT INTO `wp_options` VALUES (1, 'siteurl', 'http://example.com', 'yes');",
	].join("\n");
	const p = writeTmp("dataonly.sql", dataOnly);
	assert.throws(() => validateSqlFile(p), /CREATE TABLE/);
});

// --- WordPress options table check ---

test("throws when no WordPress options table is found", () => {
	const nonWp = [
		"-- MySQL dump 10.13",
		"CREATE TABLE `unrelated_table` (`id` int);",
	].join("\n");
	const p = writeTmp("nonwp.sql", nonWp);
	assert.throws(() => validateSqlFile(p), /options table/);
});

// --- happy path ---

test("passes for a valid WordPress mysqldump", () => {
	const p = writeTmp("valid.sql", VALID_DUMP);
	assert.doesNotThrow(() => validateSqlFile(p));
});

test("passes with a custom table prefix", () => {
	const customPrefix = VALID_DUMP.replace("wp_options", "mysite_options");
	const p = writeTmp("custprefix.sql", customPrefix);
	assert.doesNotThrow(() => validateSqlFile(p));
});
