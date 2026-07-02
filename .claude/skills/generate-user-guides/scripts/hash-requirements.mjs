#!/usr/bin/env node
// Print the per-requirement content hashes for every canonical spec.
//
// Usage:
//   node hash-requirements.mjs            # human-readable table
//   node hash-requirements.mjs --json     # JSON [{capability, name, hash}]
//   node hash-requirements.mjs <cap>      # only requirements for one capability
//
// These are the values the generator embeds in each page's traceability footer.

import { findRepoRoot, parseSpecs } from './lib.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const capFilter = args.find((a) => !a.startsWith('--'));

const repoRoot = findRepoRoot();
let rows = parseSpecs(repoRoot);
if (capFilter) rows = rows.filter((r) => r.capability === capFilter);

if (asJson) {
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
} else {
  for (const r of rows) {
    process.stdout.write(`${r.hash}  ${r.capability}  ::  ${r.name}\n`);
  }
  process.stdout.write(`\n${rows.length} requirement(s)\n`);
}
