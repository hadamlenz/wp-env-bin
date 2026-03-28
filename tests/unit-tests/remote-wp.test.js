import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRemoteCmd } from "../../lib/utils/run.js";

// ── buildRemoteCmd ─────────────────────────────────────────────────────────────

test("buildRemoteCmd: pantheon builds terminus command", () => {
	const config = { host: "pantheon", env: "mysite.live" };
	const cmd = buildRemoteCmd(config, "db export -");
	assert.equal(cmd, "terminus wp mysite.live -- db export -");
});

test("buildRemoteCmd: no host defaults to pantheon", () => {
	const config = { env: "mysite.live" };
	const cmd = buildRemoteCmd(config, "db tables --format=csv");
	assert.equal(cmd, "terminus wp mysite.live -- db tables --format=csv");
});

test("buildRemoteCmd: ssh builds wp --ssh= command", () => {
	const config = { host: "ssh", env: "user@example.com/var/www/html" };
	const cmd = buildRemoteCmd(config, "db export -");
	assert.equal(cmd, "wp --ssh=user@example.com/var/www/html db export -");
});

test("buildRemoteCmd: wpvip builds vip wp command", () => {
	const config = { host: "wpvip", env: "myapp.production" };
	const cmd = buildRemoteCmd(config, "db export -");
	assert.equal(cmd, "vip wp myapp.production -- db export -");
});

test("buildRemoteCmd: unknown host throws with helpful message", () => {
	const config = { host: "unknown-host", env: "somesite" };
	assert.throws(
		() => buildRemoteCmd(config, "db export -"),
		/Unknown host type in wp-env-bin\.config\.json: unknown-host/
	);
});
