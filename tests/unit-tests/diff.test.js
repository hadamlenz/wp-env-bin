"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const ROOT  = path.join(__dirname, "../..");
const { diffScreenshots } = require(path.join(ROOT, "lib/compare"));

/**
 * Build a solid-colour PNG buffer using pngjs.
 *
 * @param {number} width
 * @param {number} height
 * @param {{ r: number, g: number, b: number }} color - RGB 0-255
 * @returns {Buffer}
 */
function solidPng(width, height, { r, g, b }) {
	const { PNG } = require("pngjs");
	const img = new PNG({ width, height });
	for (let i = 0; i < width * height; i++) {
		img.data[i * 4 + 0] = r;
		img.data[i * 4 + 1] = g;
		img.data[i * 4 + 2] = b;
		img.data[i * 4 + 3] = 255; // fully opaque
	}
	return PNG.sync.write(img);
}

// --- identical images ---

test("diffScreenshots: identical PNGs produce 0% diff", () => {
	const png = solidPng(100, 100, { r: 200, g: 100, b: 50 });
	const { diffPercent } = diffScreenshots(png, png, 1);
	assert.equal(diffPercent, 0);
});

// --- completely different images ---

test("diffScreenshots: fully different solid-colour PNGs produce >90% diff", () => {
	const red   = solidPng(100, 100, { r: 255, g: 0, b: 0 });
	const blue  = solidPng(100, 100, { r: 0, g: 0, b: 255 });
	const { diffPercent } = diffScreenshots(red, blue, 1);
	assert.ok(diffPercent > 90, `expected >90% diff, got ${diffPercent.toFixed(2)}%`);
});

// --- diffPng is a valid PNG buffer ---

test("diffScreenshots: diffPng is a Buffer", () => {
	const red  = solidPng(50, 50, { r: 255, g: 0, b: 0 });
	const blue = solidPng(50, 50, { r: 0, g: 0, b: 255 });
	const { diffPng } = diffScreenshots(red, blue, 1);
	assert.ok(Buffer.isBuffer(diffPng));
});

test("diffScreenshots: diffPng has the same dimensions as the inputs", () => {
	const { PNG } = require("pngjs");
	const a = solidPng(80, 60, { r: 255, g: 255, b: 255 });
	const b = solidPng(80, 60, { r: 0, g: 0, b: 0 });
	const { diffPng } = diffScreenshots(a, b, 1);
	const parsed = PNG.sync.read(diffPng);
	assert.equal(parsed.width, 80);
	assert.equal(parsed.height, 60);
});

// --- padding: images of different heights ---

test("diffScreenshots: handles images of different heights without throwing", () => {
	const tall  = solidPng(100, 200, { r: 255, g: 255, b: 255 });
	const short = solidPng(100, 100, { r: 255, g: 255, b: 255 });
	assert.doesNotThrow(() => diffScreenshots(tall, short, 1));
});

test("diffScreenshots: padded image uses max height as totalPixels", () => {
	const tall  = solidPng(100, 200, { r: 255, g: 255, b: 255 });
	const short = solidPng(100, 100, { r: 255, g: 255, b: 255 });
	const { totalPixels } = diffScreenshots(tall, short, 1);
	assert.equal(totalPixels, 100 * 200);
});

// --- return shape ---

test("diffScreenshots: result contains diffPixels, totalPixels, diffPercent, diffPng", () => {
	const png = solidPng(10, 10, { r: 128, g: 128, b: 128 });
	const result = diffScreenshots(png, png, 1);
	assert.ok("diffPixels"  in result);
	assert.ok("totalPixels" in result);
	assert.ok("diffPercent" in result);
	assert.ok("diffPng"     in result);
});
