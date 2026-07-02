#!/usr/bin/env node
// Status / dry-run: report guide staleness by comparing footer-embedded hashes
// against the current spec hashes. WRITES NOTHING and never touches the browser.
//
// Usage:
//   node check.mjs            # human-readable report
//   node check.mjs --json     # machine-readable summary
//
// Reports, per page:
//   - stale      : a cited requirement's current hash differs from the footer
//   - orphaned   : a cited requirement no longer exists in the specs
//   - no-footer  : page has no parseable traceability footer -> regenerate
// And repo-wide:
//   - uncovered  : a spec requirement cited by no page (a gap OR intentional plumbing)

import { buildPageIndex, findRepoRoot, key, relPath, specsByKey } from './lib.mjs';

const asJson = process.argv.includes('--json');
const repoRoot = findRepoRoot();
const specs = specsByKey(repoRoot);
const pages = buildPageIndex(repoRoot);

const report = { stale: [], orphaned: [], noFooter: [], uncovered: [] };
const cited = new Set();

for (const { page, citations } of pages) {
  const rel = relPath(repoRoot, page);
  if (citations === null) {
    report.noFooter.push(rel);
    continue;
  }
  for (const c of citations) {
    const k = key(c.capability, c.name);
    cited.add(k);
    const spec = specs.get(k);
    if (!spec) {
      report.orphaned.push({ page: rel, capability: c.capability, requirement: c.name });
    } else if (spec.hash !== c.hash) {
      report.stale.push({ page: rel, capability: c.capability, requirement: c.name });
    }
  }
}

for (const [k, r] of specs) {
  if (!cited.has(k)) report.uncovered.push({ capability: r.capability, requirement: r.name });
}

const pagesToRegen = new Set([
  ...report.stale.map((s) => s.page),
  ...report.orphaned.map((s) => s.page),
  ...report.noFooter,
]);

if (asJson) {
  process.stdout.write(
    JSON.stringify({ ...report, pagesToRegenerate: [...pagesToRegen] }, null, 2) + '\n',
  );
} else {
  const line = (label, items, fmt) => {
    process.stdout.write(`\n${label} (${items.length}):\n`);
    for (const it of items) process.stdout.write(`  - ${fmt(it)}\n`);
  };
  process.stdout.write('=== user-guide staleness report (read-only) ===\n');
  line('STALE — cited requirement changed', report.stale, (s) => `${s.page}  <-  ${s.capability} :: ${s.requirement}`);
  line('ORPHANED — cited requirement gone', report.orphaned, (s) => `${s.page}  <-  ${s.capability} :: ${s.requirement}`);
  line('NO FOOTER — regenerate', report.noFooter, (p) => p);
  line('UNCOVERED — cited by no page (gap or intentional plumbing)', report.uncovered, (u) => `${u.capability} :: ${u.requirement}`);
  process.stdout.write(`\n=> ${pagesToRegen.size} page(s) need regeneration.\n`);
}
