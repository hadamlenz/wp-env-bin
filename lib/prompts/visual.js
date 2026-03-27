"use strict";

const { execSync } = require("child_process");
const { compare } = require("../../commands/compare");
const { compareHelp } = require("../../commands/help");

async function handleVisualCompare(argv) {
	if (argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
		compareHelp();
		return;
	}

	const { confirm } = await import("@inquirer/prompts");
	const { reportPath, failCount, errorCount } = await compare(argv);
	const openReport = await confirm({ message: "Open report in browser?", default: true });
	if (openReport) {
		const opener = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
		execSync(opener + " \"" + reportPath + "\"");
	}
	if (failCount > 0 || errorCount > 0) {
		process.exit(1);
	}
}

module.exports = { handleVisualCompare };
