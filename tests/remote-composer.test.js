"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matchActivePlugins, buildComposerJson } = require("../lib/remote-composer");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const serverComposer = {
	require: {
		"gravity/gravityforms": "^2.9",
		"wpengine/advanced-custom-fields-pro": "^6.2.9",
	},
	"require-dev": {
		"wpackagist-plugin/megamenu": "3.7",
		"wpackagist-plugin/redirection": "5.6.1",
		"external/easy-code-manager": "^10.51",
		"unc/unc-cookie-banner": "*",
		"wpackagist-theme/unc-theme": "*",
	},
};

const serverRepos = [
	{ type: "composer", url: "https://wpackagist.org", only: ["wpackagist-plugin/*", "wpackagist-theme/*"] },
	{ type: "composer", url: "https://composer.gravity.io" },
	{ type: "composer", url: "https://connect.advancedcustomfields.com" },
	{ type: "vcs", url: "https://gitlab.com/uncds/easy-code-manager" },
];

// ── matchActivePlugins ────────────────────────────────────────────────────────

test("matchActivePlugins: matches plugin path to package in require-dev", () => {
	const { matched } = matchActivePlugins(["megamenu/megamenu.php"], serverComposer);
	assert.ok("wpackagist-plugin/megamenu" in matched);
	assert.equal(matched["wpackagist-plugin/megamenu"], "3.7");
});

test("matchActivePlugins: matches plugin path to package in require", () => {
	const { matched } = matchActivePlugins(["gravityforms/gravityforms.php"], serverComposer);
	assert.ok("gravity/gravityforms" in matched);
	assert.equal(matched["gravity/gravityforms"], "^2.9");
});

test("matchActivePlugins: matches when vendor prefix differs from folder name", () => {
	// Composer installs "wpengine/advanced-custom-fields-pro" into "advanced-custom-fields-pro/"
	const { matched } = matchActivePlugins(["advanced-custom-fields-pro/acf.php"], serverComposer);
	assert.ok("wpengine/advanced-custom-fields-pro" in matched);
});

test("matchActivePlugins: puts unrecognized plugin folder in unmatched", () => {
	const { unmatched } = matchActivePlugins(["hello-dolly/hello.php"], serverComposer);
	assert.ok(unmatched.includes("hello-dolly"));
});

test("matchActivePlugins: searches both require and require-dev", () => {
	const { matched, unmatched } = matchActivePlugins([
		"gravityforms/gravityforms.php",
		"megamenu/megamenu.php",
	], serverComposer);
	assert.ok("gravity/gravityforms" in matched);
	assert.ok("wpackagist-plugin/megamenu" in matched);
	assert.equal(unmatched.length, 0);
});

test("matchActivePlugins: deduplicates duplicate folder entries", () => {
	// Simulates a plugin appearing in both active_plugins and active_sitewide_plugins
	const { matched } = matchActivePlugins([
		"megamenu/megamenu.php",
		"megamenu/megamenu.php",
	], serverComposer);
	assert.equal(Object.keys(matched).length, 1);
});

test("matchActivePlugins: returns empty matched and all unmatched when serverComposer has no packages", () => {
	const { matched, unmatched } = matchActivePlugins(
		["gravityforms/gravityforms.php", "hello-dolly/hello.php"],
		{}
	);
	assert.deepEqual(matched, {});
	assert.deepEqual(unmatched, ["gravityforms", "hello-dolly"]);
});

test("matchActivePlugins: handles empty activePaths", () => {
	const { matched, unmatched } = matchActivePlugins([], serverComposer);
	assert.deepEqual(matched, {});
	assert.deepEqual(unmatched, []);
});

// ── buildComposerJson ─────────────────────────────────────────────────────────

test("buildComposerJson: includes matched packages in require-dev", () => {
	const matched = { "gravity/gravityforms": "^2.9", "wpackagist-plugin/megamenu": "3.7" };
	const result = buildComposerJson(matched, serverRepos, null);
	assert.equal(result["require-dev"]["gravity/gravityforms"], "^2.9");
	assert.equal(result["require-dev"]["wpackagist-plugin/megamenu"], "3.7");
});

test("buildComposerJson: passes repositories through unchanged", () => {
	const result = buildComposerJson({}, serverRepos, null);
	assert.deepEqual(result.repositories, serverRepos);
});

test("buildComposerJson: includes theme entry when themeMatched is provided", () => {
	const result = buildComposerJson({}, serverRepos, { "wpackagist-theme/unc-theme": "*" });
	assert.equal(result["require-dev"]["wpackagist-theme/unc-theme"], "*");
});

test("buildComposerJson: omits theme when themeMatched is null", () => {
	const result = buildComposerJson({ "gravity/gravityforms": "^2.9" }, serverRepos, null);
	const themeKeys = Object.keys(result["require-dev"]).filter(k => k.startsWith("wpackagist-theme/"));
	assert.equal(themeKeys.length, 0);
});

test("buildComposerJson: returns empty require-dev when matched is empty and no theme", () => {
	const result = buildComposerJson({}, [], null);
	assert.deepEqual(result["require-dev"], {});
});

test("buildComposerJson: preserves installer-paths structure", () => {
	const result = buildComposerJson({}, [], null);
	assert.ok(result.extra["installer-paths"]["./themes/{$name}/"].includes("type:wordpress-theme"));
	assert.ok(result.extra["installer-paths"]["./plugins/{$name}"].includes("type:wordpress-plugin"));
});

test("buildComposerJson: preserves config.platform.php", () => {
	const result = buildComposerJson({}, [], null);
	assert.equal(result.config.platform.php, "8.3");
});

test("buildComposerJson: uses empty array when repositories is null", () => {
	const result = buildComposerJson({}, null, null);
	assert.deepEqual(result.repositories, []);
});
