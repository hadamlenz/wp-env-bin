import { execSync } from "child_process";
import { confirm } from "@inquirer/prompts";

import { compare } from "../../commands/compare.js";
import { compareHelp } from "../../commands/help.js";

async function visualComparePrompt(argv) {
	if (argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
		compareHelp();
		return;
	}

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

export { visualComparePrompt };
