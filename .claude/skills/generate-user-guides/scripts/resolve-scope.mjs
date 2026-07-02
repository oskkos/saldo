#!/usr/bin/env node
// Resolve a scope argument to the set of guide pages it affects, using the
// traceability footers as a reverse index (requirement/capability -> pages).
//
// Usage:
//   node resolve-scope.mjs                 # default: pages whose cited reqs changed
//   node resolve-scope.mjs <capability>    # pages citing any requirement of <capability>
//   node resolve-scope.mjs "<Requirement>" # pages citing a requirement by name
//   node resolve-scope.mjs <page.md>       # that page (by filename)
//   node resolve-scope.mjs --json          # emit JSON list of absolute page paths
//
// Matching is case-insensitive and substring-based so the skill can pass a fuzzy
// scope; Claude resolves ambiguity from the printed candidates.

import { buildPageIndex, findRepoRoot, key, relPath, specsByKey } from './lib.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const scope = args.find((a) => !a.startsWith('--'));

const repoRoot = findRepoRoot();
const pages = buildPageIndex(repoRoot);

let matched;

if (!scope) {
  // Default: manifest delta — pages whose cited requirement hashes moved (or no footer).
  const specs = specsByKey(repoRoot);
  matched = pages.filter(({ citations }) => {
    if (citations === null) return true;
    return citations.some((c) => {
      const spec = specs.get(key(c.capability, c.name));
      return !spec || spec.hash !== c.hash;
    });
  });
} else {
  const needle = scope.toLowerCase();
  matched = pages.filter(({ page, citations }) => {
    if (page.toLowerCase().endsWith(needle) || page.toLowerCase().includes(needle)) {
      // Filename match only counts if the needle looks like a page name.
      if (needle.endsWith('.md')) return true;
    }
    if (citations === null) return false;
    return citations.some(
      (c) =>
        c.capability.toLowerCase().includes(needle) ||
        c.name.toLowerCase().includes(needle),
    );
  });
}

const paths = matched.map((m) => m.page);
if (asJson) {
  process.stdout.write(JSON.stringify(paths, null, 2) + '\n');
} else {
  if (!paths.length) {
    process.stdout.write(scope ? `No pages match scope: ${scope}\n` : 'No pages need regeneration.\n');
  } else {
    for (const p of paths) process.stdout.write(relPath(repoRoot, p) + '\n');
  }
}
