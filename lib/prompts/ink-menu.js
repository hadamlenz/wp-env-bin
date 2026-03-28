import React, { useState } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { spawnSync } from 'child_process';
import path from 'path';

import { readRawConfig } from '../env/config.js';
import { envSyncPrompt } from './env.js';
import { dbGetPrompt, dbProcessPrompt } from './db.js';
import { configCreatePrompt, configSwitchPrompt, configUpdatePrompt, configInstallPrompt } from './config.js';
import { e2eScaffoldPrompt } from './e2e.js';
import { composerGetPrompt, composerMakePrompt } from './composer.js';
import { htaccessMakePrompt } from './htaccess.js';
import { visualComparePrompt } from './visual.js';
import { runWpEnv, runWpEnvE2e } from '../../commands/env.js';
import { generateE2eTests, runE2eTests } from '../../commands/e2e.js';
import { scaffoldCommand } from '../../commands/scaffold.js';
import { cleanAll } from '../../commands/clean.js';

// ── Menu definitions ──────────────────────────────────────────────────────────

const MENUS = {
	main: {
		items: [
			{ label: 'Quick Actions', hint: 'common workflows', id: 'quick', type: 'menu' },
			{ label: 'Environment', hint: 'sync, start, stop', id: 'environment', type: 'menu' },
			{ label: 'Database', hint: 'get, process, import', id: 'database', type: 'menu' },
			{ label: 'Config', hint: 'profiles & settings', id: 'config-menu', type: 'menu' },
			{ label: 'E2E Testing', hint: 'scaffold, generate, run', id: 'e2e', type: 'menu' },
			{ label: 'Advanced', hint: 'composer, htaccess, clean', id: 'advanced', type: 'menu' },
			{ label: 'View Config Files', hint: 'browse loaded configs', id: 'configs', type: 'menu' },
		],
	},
	quick: {
		title: 'Quick Actions',
		items: [
			{ label: 'Sync & Start', hint: 'pull remote DB then start wp-env', id: 'env:sync-start', type: 'action' },
			{ label: 'Fresh DB', hint: 'db get → db process in sequence', id: 'db:fresh', type: 'action' },
			{ label: 'Run E2E Tests', hint: 'run full playwright test suite', id: 'e2e:test', type: 'action' },
			{ label: 'Switch Site', hint: 'change the active config profile', id: 'config:switch', type: 'action' },
		],
	},
	environment: {
		title: 'Environment',
		items: [
			{ label: 'Sync & Start', hint: 'sync DB then start', id: 'env:sync-start', type: 'action' },
			{ label: 'Sync DB', hint: 'pull remote database', id: 'env:sync', type: 'action' },
			{ label: 'Start', hint: 'wp-env start', id: 'env:start', type: 'action' },
			{ label: 'Stop', hint: 'wp-env stop', id: 'env:stop', type: 'action' },
			{ label: 'Restart', hint: 'wp-env stop → start', id: 'env:restart', type: 'action' },
		],
	},
	database: {
		title: 'Database',
		items: [
			{ label: 'Get Remote DB', hint: 'download from remote host', id: 'db:get', type: 'action' },
			{ label: 'Process / Import', hint: 'transform and import SQL', id: 'db:process', type: 'action' },
		],
	},
	'config-menu': {
		title: 'Config',
		items: [
			{ label: 'Create Config', hint: 'new wp-env-bin.config.json', id: 'config:create', type: 'action' },
			{ label: 'Switch Profile', hint: 'load a saved config profile', id: 'config:switch', type: 'action' },
			{ label: 'Update Config', hint: 'edit current config values', id: 'config:update', type: 'action' },
			{ label: 'Install Config', hint: 'copy profile to active slot', id: 'config:install', type: 'action' },
			{ label: 'View Config Files', hint: 'browse loaded configs', id: 'configs', type: 'menu' },
		],
	},
	e2e: {
		title: 'E2E Testing',
		items: [
			{ label: 'Run Tests', hint: 'run playwright test suite', id: 'e2e:test', type: 'action' },
			{ label: 'Environment', hint: 'start, stop, restart e2e env', id: 'e2e-env', type: 'menu' },
			{ label: 'Scaffold E2E', hint: 'set up e2e directory', id: 'e2e:scaffold', type: 'action' },
			{ label: 'Generate Tests', hint: 'create specs from block.json', id: 'e2e:generate', type: 'action' },
		],
	},
	'e2e-env': {
		title: 'E2E Environment',
		items: [
			{ label: 'Start', hint: 'wp-env start (e2e)', id: 'e2e-env:start', type: 'action' },
			{ label: 'Stop', hint: 'wp-env stop (e2e)', id: 'e2e-env:stop', type: 'action' },
			{ label: 'Restart', hint: 'wp-env stop → start (e2e)', id: 'e2e-env:restart', type: 'action' },
			{ label: 'Update', hint: 'wp-env start --update (e2e)', id: 'e2e-env:update', type: 'action' },
		],
	},
	advanced: {
		title: 'Advanced',
		items: [
			{
				label: 'Composer Get',
				hint: 'fetch remote composer package',
				id: 'advanced:composer-get',
				type: 'action',
			},
			{
				label: 'Composer Make',
				hint: 'generate local composer.json',
				id: 'advanced:composer-make',
				type: 'action',
			},
			{ label: 'Make .htaccess', hint: 'generate reverse proxy config', id: 'advanced:htaccess', type: 'action' },
			{
				label: 'Scaffold Project',
				hint: 'copy wp-env-bin scaffold files',
				id: 'advanced:scaffold',
				type: 'action',
			},
			{ label: 'Visual Compare', hint: 'screenshot diff vs live site', id: 'advanced:visual', type: 'action' },
			{ label: 'Clean All', hint: 'remove generated artifacts', id: 'advanced:clean', type: 'action' },
		],
	},
	configs: {
		title: 'Config Files',
		items: [
			{ label: 'Site Config', hint: 'wp-env-bin.config.json', source: 'config', type: 'config' },
			{ label: 'WP-Env', hint: '.wp-env.json', source: 'wp-env', type: 'config' },
			{ label: 'E2E Config', hint: 'e2e/wp-env-bin.e2e.config.json', source: 'e2e.config', type: 'config' },
			{ label: 'Composer', hint: 'wp-env-bin/composer.json', source: 'composer', type: 'config' },
			{ label: 'E2E Composer', hint: 'e2e/composer.json', source: 'e2e.composer', type: 'config' },
		],
	},
};

// ── Config flattener ──────────────────────────────────────────────────────────
// Turns a JSON object into a flat list of { depth, key, value, isObject } rows
// for rendering as an indented tree.

function flattenJson(data, depth = 0) {
	const rows = [];
	if (data === null || typeof data !== 'object') {
		return [{ depth, key: '', value: String(data ?? ''), isObject: false }];
	}
	const entries = Array.isArray(data) ? data.map((v, i) => [String(i), v]) : Object.entries(data);
	for (const [key, value] of entries) {
		if (value !== null && typeof value === 'object') {
			rows.push({ depth, key, value: Array.isArray(value) ? '[ ]' : '{ }', isObject: true });
			rows.push(...flattenJson(value, depth + 1));
		} else {
			rows.push({ depth, key, value: String(value ?? ''), isObject: false });
		}
	}
	return rows;
}

// ── Status bar ────────────────────────────────────────────────────────────────

function StatusBar({ siteConfig, running, port, e2eRunning, e2ePort }) {
	const configLabel = siteConfig
		? (siteConfig.url ?? '(no url)') + '  ·  ' + (siteConfig.siteType ?? 'singlesite')
		: 'no config';
	const envLabel = running ? 'running · localhost:' + port : 'stopped';
	const envColor = running ? 'green' : 'yellow';
	const e2eLabel = e2eRunning ? 'running · localhost:' + e2ePort : 'stopped';
	const e2eColor = e2eRunning ? 'green' : 'yellow';

	return React.createElement(
		Box,
		{ borderStyle: 'single', borderColor: 'gray', paddingX: 1, flexDirection: 'column', marginBottom: 1 },
		React.createElement(
			Box,
			{ gap: 1 },
			React.createElement(Text, { bold: true, color: 'gray' }, 'config  '),
			React.createElement(Text, { color: 'cyan' }, configLabel)
		),
		React.createElement(
			Box,
			{ gap: 1 },
			React.createElement(Text, { bold: true, color: 'gray' }, 'env     '),
			React.createElement(Text, { color: envColor }, envLabel)
		),
		React.createElement(
			Box,
			{ gap: 1 },
			React.createElement(Text, { bold: true, color: 'gray' }, 'e2e env '),
			React.createElement(Text, { color: e2eColor }, e2eLabel)
		)
	);
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ stack }) {
	const parts = stack.map((frame) => {
		if (frame.type === 'menu') {
			if (frame.id === 'main') return 'wp-env-bin';
			return MENUS[frame.id]?.title ?? frame.id;
		}
		return frame.label;
	});
	return React.createElement(
		Box,
		{ marginBottom: 1 },
		React.createElement(Text, { color: 'gray' }, parts.join('  ›  '))
	);
}

// ── Menu list ─────────────────────────────────────────────────────────────────

function MenuList({ items, cursor }) {
	return React.createElement(
		Box,
		{ flexDirection: 'column' },
		items.map((item, i) => {
			const active = i === cursor;
			return React.createElement(
				Box,
				{ key: i, gap: 1 },
				React.createElement(Text, { color: active ? 'blue' : 'gray' }, active ? '❯' : ' '),
				React.createElement(Text, { color: active ? 'white' : 'gray', bold: active }, item.label),
				item.hint ? React.createElement(Text, { color: 'gray' }, '  ' + item.hint) : null
			);
		})
	);
}

// ── Config tree view ──────────────────────────────────────────────────────────

const CONFIG_VISIBLE = 18;

function ConfigView({ rows, cursor }) {
	if (!rows.length) {
		return React.createElement(Text, { color: 'red' }, '  (file not found)');
	}
	const start = Math.max(0, Math.min(cursor - Math.floor(CONFIG_VISIBLE / 2), rows.length - CONFIG_VISIBLE));
	const slice = rows.slice(start, start + CONFIG_VISIBLE);

	return React.createElement(
		Box,
		{ flexDirection: 'column' },
		slice.map((row, i) => {
			const idx = start + i;
			const active = idx === cursor;
			const indent = '  '.repeat(row.depth);
			return React.createElement(
				Box,
				{ key: idx },
				React.createElement(Text, { color: active ? 'blue' : 'transparent' }, active ? '❯ ' : '  '),
				React.createElement(Text, {}, indent),
				React.createElement(Text, { color: 'cyan' }, row.key),
				row.key
					? React.createElement(Text, { color: 'gray' }, row.isObject ? '  ' + row.value : ':  ' + row.value)
					: React.createElement(Text, { color: 'gray' }, row.value)
			);
		}),
		rows.length > CONFIG_VISIBLE
			? React.createElement(
					Text,
					{ color: 'gray' },
					'  ' +
						(start + CONFIG_VISIBLE < rows.length
							? '▼ ' + (rows.length - start - CONFIG_VISIBLE) + ' more'
							: '')
				)
			: null
	);
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Key({ label }) {
	return React.createElement(
		Box,
		{ borderStyle: 'round', borderColor: 'gray', paddingX: 1 },
		React.createElement(Text, { color: 'white' }, label)
	);
}

function KeyHint({ keyLabel, hint }) {
	return React.createElement(
		Box,
		{ flexDirection: 'column', alignItems: 'center', marginRight: 2 },
		React.createElement(Key, { label: keyLabel }),
		React.createElement(Text, { color: 'gray' }, hint)
	);
}

function Footer({ isConfigView }) {
	const pairs = isConfigView
		? [
				['↑↓', 'scroll'],
				['Esc', 'back'],
			]
		: [
				['↑↓', 'navigate'],
				['Enter', 'select'],
				['Esc', 'back'],
				['q', 'quit'],
			];

	return React.createElement(
		Box,
		{ marginTop: 1, flexDirection: 'row' },
		...pairs.map(([k, h]) => React.createElement(KeyHint, { key: k, keyLabel: k, hint: h }))
	);
}

// ── App ───────────────────────────────────────────────────────────────────────

function App({ siteConfig, running, port, e2eRunning, e2ePort, initialStack, initialCursor, onAction }) {
	const { exit } = useApp();
	// Each frame: { type: 'menu', id } or { type: 'cfgview', label, rows }
	const [stack, setStack] = useState(initialStack);
	const [cursor, setCursor] = useState(initialCursor);

	const frame = stack[stack.length - 1];
	const isConfigView = frame.type === 'cfgview';
	const items = isConfigView ? [] : (MENUS[frame.id]?.items ?? []);

	function goBack() {
		if (stack.length > 1) {
			setStack((s) => s.slice(0, -1));
			setCursor(0);
		} else {
			exit();
		}
	}

	useInput((input, key) => {
		if (key.escape || key.leftArrow) {
			goBack();
			return;
		}

		if (isConfigView) {
			if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
			if (key.downArrow) setCursor((c) => Math.min(frame.rows.length - 1, c + 1));
			return;
		}

		if (input === 'q') {
			exit();
			return;
		}

		if (key.upArrow) {
			setCursor((c) => Math.max(0, c - 1));
			return;
		}
		if (key.downArrow) {
			setCursor((c) => Math.min(items.length - 1, c + 1));
			return;
		}

		if (key.return) {
			const item = items[cursor];
			if (!item) return;

			if (item.type === 'menu') {
				setStack((s) => [...s, { type: 'menu', id: item.id }]);
				setCursor(0);
			} else if (item.type === 'config') {
				const data = readRawConfig(item.source);
				const rows = data ? flattenJson(data) : [];
				setStack((s) => [...s, { type: 'cfgview', label: item.label, rows }]);
				setCursor(0);
			} else if (item.type === 'action') {
				onAction(item.id, stack, cursor);
				exit();
			}
		}
	});

	return React.createElement(
		Box,
		{ flexDirection: 'column', padding: 1 },
		React.createElement(StatusBar, { siteConfig, running, port, e2eRunning, e2ePort }),
		React.createElement(Breadcrumb, { stack }),
		isConfigView
			? React.createElement(ConfigView, { rows: frame.rows, cursor })
			: React.createElement(MenuList, { items, cursor }),
		React.createElement(Footer, { isConfigView })
	);
}

// ── Action runner ─────────────────────────────────────────────────────────────

async function runAction(id) {
	switch (id) {
		case 'env:sync-start':
			await envSyncPrompt();
			runWpEnv(['start']);
			break;
		case 'env:sync':
			await envSyncPrompt();
			break;
		case 'env:start':
			runWpEnv(['start']);
			break;
		case 'env:stop':
			runWpEnv(['stop']);
			break;
		case 'env:restart':
			runWpEnv(['stop']);
			runWpEnv(['start']);
			break;
		case 'db:get':
			await dbGetPrompt();
			break;
		case 'db:process':
			await dbProcessPrompt();
			break;
		case 'db:fresh':
			await dbGetPrompt();
			await dbProcessPrompt();
			break;
		case 'config:create':
			await configCreatePrompt();
			break;
		case 'config:switch':
			await configSwitchPrompt();
			break;
		case 'config:update':
			await configUpdatePrompt();
			break;
		case 'config:install':
			await configInstallPrompt();
			break;
		case 'e2e:scaffold':
			await e2eScaffoldPrompt();
			break;
		case 'e2e:generate':
			generateE2eTests([]);
			break;
		case 'e2e:test':
			runE2eTests([]);
			break;
		case 'advanced:composer-get':
			await composerGetPrompt();
			break;
		case 'advanced:composer-make':
			await composerMakePrompt();
			break;
		case 'advanced:htaccess':
			await htaccessMakePrompt();
			break;
		case 'advanced:scaffold':
			scaffoldCommand(path.join(process.cwd(), 'wp-env-bin'));
			break;
		case 'advanced:visual':
			await visualComparePrompt([]);
			break;
		case 'advanced:clean':
			cleanAll();
			break;
		case 'e2e-env:start':
			runWpEnvE2e(['start']);
			break;
		case 'e2e-env:stop':
			runWpEnvE2e(['stop']);
			break;
		case 'e2e-env:restart':
			runWpEnvE2e(['stop']);
			runWpEnvE2e(['start']);
			break;
		case 'e2e-env:update':
			runWpEnvE2e(['start', '--update']);
			break;
	}
}

// ── Entry point ───────────────────────────────────────────────────────────────

// Check if something is actually listening on a port using nc.
// More reliable than `wp-env status` which exits 0 unconditionally in some versions.
function isPortListening(port) {
	const result = spawnSync('nc', ['-z', '-w', '1', 'localhost', String(port)], { stdio: 'pipe' });
	return result.status === 0;
}

function readStatus() {
	const siteConfig = readRawConfig('config');

	const wpEnv = readRawConfig('wp-env');
	const port = wpEnv?.env?.development?.port ?? wpEnv?.port ?? 8888;

	const e2eCfg = readRawConfig('e2e.config');
	const e2ePort = e2eCfg?.port ?? 8886;

	const running = isPortListening(port);
	const e2eRunning = isPortListening(e2ePort);

	return { siteConfig, running, port, e2eRunning, e2ePort };
}

async function inkMenuPrompt() {
	let navStack = [{ type: 'menu', id: 'main' }];
	let navCursor = 0;

	while (true) {
		const status = readStatus();
		let selectedAction = null;
		let savedStack = navStack;
		let savedCursor = navCursor;

		process.stdout.write('\x1Bc');

		const { waitUntilExit } = render(
			React.createElement(App, {
				...status,
				initialStack: navStack,
				initialCursor: navCursor,
				onAction: (id, stack, cursor) => {
					selectedAction = id;
					savedStack = stack;
					savedCursor = cursor;
				},
			}),
			{ isScreenReaderEnabled: true }
		);

		await waitUntilExit();

		if (!selectedAction) break; // user quit via Esc or q

		await runAction(selectedAction);

		navStack = savedStack;
		navCursor = savedCursor;
	}
}

export { inkMenuPrompt };
