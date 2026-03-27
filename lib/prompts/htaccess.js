"use strict";

const { makeHtaccess } = require("../../commands/htaccess");
const { checkHtaccess } = require("../env/check");

async function htaccessMakePrompt() {
	let action = "regenerate";
	if (checkHtaccess()) {
		const { select } = await import("@inquirer/prompts");
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

module.exports = { htaccessMakePrompt };
