import { select } from "@inquirer/prompts";

import { makeHtaccess } from "../../commands/htaccess.js";
import { checkHtaccess } from "../env/check.js";

async function htaccessMakePrompt() {
	let action = "regenerate";
	if (checkHtaccess()) {
		action = await select({
			message: "wp-env-bin/assets/.htaccess already exists. What would you like to do?",
			choices: [
				{ name: "Use the existing .htaccess", value: "useIt" },
				{ name: "Regenerate from current config", value: "regenerate" },
			],
		});
	}
	makeHtaccess({ action });
}

export { htaccessMakePrompt };
