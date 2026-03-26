#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const path = require("path");
const chalk = require("chalk");

const REPO_ROOT = path.resolve(__dirname, "../..");

const child = spawn("node", ["--test", "tests/integration/integration.test.js"], {
	cwd: REPO_ROOT,
	stdio: ["inherit", "pipe", "pipe"],
});

const stripAnsi = (s) => s.replace(/\x1B\[[0-9;]*[mGKH]/g, "");

function colorLine(line) {
	const clean = stripAnsi(line);
	if (/^\s+✔/.test(clean)) return chalk.green(clean);
	if (/^\s+✖/.test(clean)) return chalk.red(clean);
	if (/^▶/.test(clean)) return chalk.bold.white(clean);
	if (/^✔/.test(clean)) return chalk.bold.green(clean);
	if (/^✖/.test(clean)) return chalk.bold.red(clean);
	if (/^ℹ/.test(clean)) return chalk.dim(clean);
	return clean;
}

let stdout = "";
let lineBuffer = "";

child.stdout.on("data", (chunk) => {
	const str = chunk.toString();
	stdout += str;
	lineBuffer += str;

	const lines = lineBuffer.split("\n");
	lineBuffer = lines.pop(); // keep incomplete last line

	for (const line of lines) {
		process.stdout.write(colorLine(line) + "\n");
	}
});

child.stderr.on("data", (chunk) => {
	process.stderr.write(chunk);
});

child.on("close", (code) => {
	// Flush any remaining partial line
	if (lineBuffer) {
		process.stdout.write(colorLine(lineBuffer) + "\n");
	}

	if (code !== 0) {
		process.exit(code ?? 1);
	}

	const idx = stdout.indexOf("▶ db get");
	const raw = idx >= 0 ? stdout.slice(idx) : stdout;

	process.stdout.write("\x1Bc");

	const w = 56;
	console.log(chalk.cyan("─".repeat(w)));
	console.log(chalk.bold("  Integration Test Report"));
	console.log(chalk.cyan("─".repeat(w)));
	console.log();

	for (const line of stripAnsi(raw).split("\n")) {
		console.log(colorLine(line));
	}
});
