#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";
import { spawn } from "child_process";
import readline from "readline";
import chalk from "chalk";
import { stopEnv } from "./helpers/env.js";

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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

function showReport(stdout) {
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
}

function promptStopEnv(exitCode) {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	rl.question(chalk.cyan("Stop the wp-env environment? [y/N] "), (answer) => {
		rl.close();
		if (/^y(es)?$/i.test(answer.trim())) {
			stopEnv();
		}
		process.exit(exitCode ?? 0);
	});
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

	showReport(stdout);
	promptStopEnv(code);
});
