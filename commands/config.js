"use strict";
const inquirer = require("inquirer");
const { run } = require("./run.js");
const { logger } = require("./log.js");
const { makeHtaccess, makeConfig } = require("./make.js");
const { getConfig, getProgConfig } = require("./get.js");
const { checkConfig } = require("./check.js");
const { startLocalBasic, startlocalRemote } = require("./start.js");

/** the cli command */
function command(subcommand, configProg) {
	switch (subcommand) {
		case "help":
		case "--help":
		case "-h":
			help(configProg.commandName,true);
			break;
		default: {
			//run config
			config();
			break;
		}
	}
}

function help(commandName, log = false) { 
	return logger(commandName + " config : start the configurator",log);
}

/**
 * run configurator in inquirer
 */
function config() {
	const questions = [
		{
			type: "list",
			name: "useConfig",
			message: "There is already a config file. What would you like to do with it?",
			when: checkConfig(),
			choices: [
				{
					name: "Use the old config as defaults",
					value: "useIt",
					description: "Use the old config as defaults",
				},
				{
					name: "Destroy the old config and start over",
					value: "destroyIt",
					description: "Destroy the old config and start over",
				},
			],
		},
		{
			type: "list",
			name: "type",
			message: "What type of environment would you like?",
			// when(answers) {
			// 	return 'destroyIt'==answers.useConfig;
			// },
			choices: [
				{
					name: "simple",
					value: "simple",
					description: "A simple environment for previewing the wilson theme",
				},
				{
					name: "multisite-copy",
					value: "multisite-copy",
					description: "A copy of a site on one of the UNC multisite networks",
				},
			],
		},
		{
			type: "confirm",
			name: "startSimple",
			message: "Would you like to start a simple unc-wilson environment? This will destroy any config that exists",
			when(answers) {
				return is_simple_answer(answers);
			},
		},
		{
			type: "confirm",
			name: "makeConfig",
			message: "Would you like to make a config interactivly?",
			when(answers) {
				return !is_simple_answer(answers) && !answers.useConfig;
			},
		},
		{
			type: "input",
			name: "env",
			message: "To copy a multisite we need a place to copy it from, What is the pantheon environment you wish to copy from?",
			when(answers) {
				return !is_simple_answer(answers) && (answers.makeConfig || answers.useConfig);
			},
			default(answers) {
				return maybeUseConfig(answers, "env");
			},
		},
		{
			type: "input",
			name: "siteId",
			message: "What is the site ID of the site you wish to copy?",
			when(answers) {
				return !is_simple_answer(answers) && (answers.makeConfig || answers.useConfig);
			},
			default(answers) {
				return maybeUseConfig(answers, "siteId");
			},
		},
		{
			type: "input",
			name: "url",
			message: "What is the url of the site you wish to copy? example 'fuubar.unc.edu'",
			when(answers) {
				return !is_simple_answer(answers) && (answers.makeConfig || answers.useConfig);
			},
			default(answers) {
				return maybeUseConfig(answers, "url");
			},
		},
		{
			type: "input",
			name: "oldPrefix",
			message: "What is the database prefix of the site you wish to copy?",
			default(answers) {
				return maybeUseConfig(answers, "oldPrefix");
			},
			when(answers) {
				return !is_simple_answer(answers) && (answers.makeConfig || answers.useConfig);
			},
		},
	];

	inquirer.prompt(questions).then((answers) => {
		if (answers.type == "simple") {
			if (answers.startSimple) {
				run("rm -f ./assets/wp-env/database.sql ./assets/wp-env/.htaccess ./assets/wp-env/config.json", { stdio: "inherit" });
				startLocalBasic();
				return;
			} else {
				logger("> you can start your own by running `npm run wilson-env`");
				return;
			}
		}

		if (!answers.makeConfig && !answers.useConfig) {
			logger("> making a blank config file at ./assets/wp-env/config.json");
			makeConfig({ env: "", url: "", oldPrefix: "", siteId: "", plugins: [] });
			logger("> go edit the file and come back");
			return;
		}

		if (answers.env && answers.siteId && answers.url && answers.prefix) {
			logger("> making a populated config file at ./assets/wp-env/config.json");
			makeConfig({ env: answers.env, url: answers.siteId, oldPrefix: answers.url, siteId: answers.prefix, plugins: defaultPlugins });
			
		}

		const moreQuestions = [
			{
				type: "confirm",
				name: "startMultisite",
				message: "Would you like to start the copy of the site in the environment?",
			},
		];

		inquirer.prompt(moreQuestions).then((moreAnswers) => {
			if (moreAnswers.startMultisite) {
				logger("> starting up a copy of a site from one of the multisite networks");
				run("npm run wilson-env start remote", { stdio: "inherit" });
				return;
			} else {
				console.log("> now that you've created a config you can start the site with `npm run wilson-env:remote`");
			}
		});
	});
}

/**
 * maybe use config items as default answers for questions
 * @param {*} answers 
 * @param {*} param 
 * @returns 
 */
function maybeUseConfig(answers, param) {
	if (answers.useConfig == "useIt") {
		var config = getConfig();
		return config[param];
	}
}

/**
 * if the answer is type simple
 * @param {*} answers 
 * @returns 
 */
function is_simple_answer(answers) {
	if (answers.type == "simple") {
		return true;
	} else {
		return false;
	}
}

module.exports = { command, help, maybeUseConfig };
