/**
 * Map a result status to its display icon.
 *
 * @param {'pass'|'warn'|'fail'} status
 * @returns {string}
 */
const statusIcon = (status) =>
	status === "pass" ? "✓" : status === "warn" ? "!" : status === "error" ? "E" : "✗";

/**
 * Map a result status to its display color.
 *
 * @param {'pass'|'warn'|'fail'} status
 * @returns {string}
 */
const statusColor = (status) =>
	status === "pass" ? "#2d7d46" : status === "warn" ? "#9a6700" : status === "error" ? "#57606a" : "#cf222e";

/**
 * Generate the summary index.html listing all tested pages with their diff % and status.
 *
 * @param {{ path: string, slug: string, diffPercent: number, status: 'pass'|'warn'|'fail' }[]} pages
 * @returns {string} HTML string
 */
const summaryTemplate = (pages) => {
	const passCount = pages.filter((p) => p.status === "pass").length;
	const warnCount = pages.filter((p) => p.status === "warn").length;
	const failCount = pages.filter((p) => p.status === "fail").length;
	const errorCount = pages.filter((p) => p.status === "error").length;

	const rows = pages.map((p) => `
		<tr>
			<td>${p.status !== "error" ? `<a href="pages/${p.slug}/index.html">${p.path}</a> (click to view comparison)` : p.path}</td>
			<td style="color:${statusColor(p.status)};font-weight:bold;text-align:center">${statusIcon(p.status)}</td>
			<td style="text-align:right">${p.diffPercent !== null ? p.diffPercent.toFixed(2) + "%" : "—"}</td>
		</tr>`).join("\n");

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>wp-env-bin visual comparison report</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1f2328; }
  h1 { font-size: 1.4rem; }
  .summary { margin: 1rem 0; font-size: 0.9rem; color: #57606a; }
  table { border-collapse: collapse; width: 100%; max-width: 700px; }
  th, td { padding: 0.5rem 0.75rem; border: 1px solid #d0d7de; text-align: left; }
  th { background: #f6f8fa; }
  tr:hover td { background: #f6f8fa; }
  .pass { color: #2d7d46; } .warn { color: #9a6700; } .fail { color: #cf222e; } .error { color: #57606a; }
</style>
</head>
<body>
<h1>Visual Comparison Report</h1>
<p class="summary">
  <span class="pass">✓ ${passCount} passed</span> &nbsp;
  <span class="warn">! ${warnCount} warnings</span> &nbsp;
  <span class="fail">✗ ${failCount} failed</span> &nbsp;
  <span class="error">E ${errorCount} errors</span> &nbsp;
  &mdash; ${pages.length} pages tested
</p>
<table>
  <thead><tr><th>Path</th><th>Status</th><th>Diff %</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;
};

/**
 * Generate the per-page comparison view showing live, local, and diff screenshots side by side.
 *
 * @param {{ path: string, diffPercent: number, status: 'pass'|'warn'|'fail' }} page
 * @returns {string} HTML string
 */
const pageTemplate = (page) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${page.path} — comparison</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 1.5rem; color: #1f2328; }
  h1 { font-size: 1.2rem; }
  .status { color: ${statusColor(page.status)}; font-weight: bold; }
  .grid { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; }
  .col { flex: 1; min-width: 280px; }
  .col h2 { font-size: 0.85rem; text-transform: uppercase; color: #57606a; margin: 0 0 0.4rem; }
  img { width: 100%; border: 1px solid #d0d7de; display: block; }
  a { color: #0969da; font-size: 0.85rem; }
</style>
</head>
<body>
<p><a href="../../index.html">&larr; Back to summary</a></p>
<h1>${page.path}</h1>
${page.status === "error"
	? `<p class="status">E Error — ${page.error || "unknown error"}</p>`
	: `<p class="status">${statusIcon(page.status)} ${page.diffPercent.toFixed(2)}% pixel difference</p>
<div class="grid">
  <div class="col"><h2>Live</h2><img src="live.png" alt="Live screenshot"></div>
  <div class="col"><h2>Local</h2><img src="local.png" alt="Local screenshot"></div>
  <div class="col"><h2>Diff</h2><img src="diff.png" alt="Pixel diff"></div>
</div>`}
</body>
</html>`;

export { summaryTemplate, pageTemplate };
