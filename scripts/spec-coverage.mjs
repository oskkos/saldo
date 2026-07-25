/**
 * Spec-to-test traceability.
 *
 * Parses the canonical specs in `openspec/specs/` and the `// @scenario`
 * annotations in the test suite, then generates the coverage map at
 * `openspec/COVERAGE.md`.
 *
 * Plain ESM on the Node standard library: no dependency, no build step.
 *
 *   node scripts/spec-coverage.mjs            # regenerate the map
 *   node scripts/spec-coverage.mjs --check    # verify without writing
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SPECS_DIR = 'openspec/specs';
export const MAP_PATH = 'openspec/COVERAGE.md';
export const EXEMPTIONS_PATH = 'scripts/spec-coverage.exemptions.json';

/**
 * Content hash of a scenario body: the first 12 hex characters of its SHA-256,
 * over the body with all whitespace collapsed. Reindenting or rewrapping a
 * scenario therefore leaves the hash alone; changing its wording moves it.
 */
export function hashScenarioBody(body) {
  const normalized = body.replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 12);
}

const REQUIREMENT_HEADING = /^###\s+Requirement:\s*(.+?)\s*$/;
const SCENARIO_HEADING = /^####\s+Scenario:\s*(.+?)\s*$/;
const ANY_HEADING = /^#{1,6}\s/;

/**
 * Extract every scenario from one capability's spec markdown.
 *
 * A scenario is identified by `<capability>/<title>` and carries its parent
 * requirement for reporting only — the requirement is deliberately not part of
 * the id, so moving a scenario between requirements does not break annotations.
 */
export function parseSpecScenarios(capability, markdown) {
  const scenarios = [];
  const seen = new Set();
  let requirement = null;
  let current = null;
  let body = [];

  const closeScenario = () => {
    if (!current) return;
    scenarios.push({ ...current, body: body.join('\n').trim() });
    current = null;
    body = [];
  };

  for (const line of markdown.split('\n')) {
    const requirementMatch = REQUIREMENT_HEADING.exec(line);
    if (requirementMatch) {
      closeScenario();
      requirement = requirementMatch[1];
      continue;
    }

    const scenarioMatch = SCENARIO_HEADING.exec(line);
    if (scenarioMatch) {
      closeScenario();
      const title = scenarioMatch[1];
      const id = `${capability}/${title}`;
      if (seen.has(id)) {
        throw new Error(
          `Duplicate scenario title: ${id}. Scenario titles must be unique within a capability.`,
        );
      }
      seen.add(id);
      current = { id, capability, title, requirement };
      continue;
    }

    if (ANY_HEADING.test(line)) {
      closeScenario();
      continue;
    }

    if (current) body.push(line);
  }

  closeScenario();
  return scenarios;
}

const ANNOTATION = /^\s*\/\/\s*@scenario\s+(\S.*?)\s*$/;
const BLANK_OR_COMMENT = /^\s*(?:\/\/|\/\*|\*|$)/;
const TEST_OPENER = /^(\s*)(it|test|describe)((?:\.\w+)*)\s*\(/;
const STRING_LITERAL = /^\s*(['"])((?:\\.|(?!\1).)*)\1/;

/** Index just past the `)` matching an already-opened `(`, or -1. */
function skipBalancedParens(text) {
  let depth = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i + 1;
  }
  return -1;
}

/** The plain string title of a test/suite call, or null if it is not literal. */
function extractTitle(afterOpenParen, modifiers) {
  const direct = STRING_LITERAL.exec(afterOpenParen);
  if (direct) return direct[2];

  // `it.each([...])('title', ...)` — the title belongs to the second call.
  if (modifiers.includes('each')) {
    const end = skipBalancedParens(afterOpenParen);
    if (end === -1) return null;
    const secondCall = /^\s*\(/.exec(afterOpenParen.slice(end));
    if (!secondCall) return null;
    const titled = STRING_LITERAL.exec(
      afterOpenParen.slice(end + secondCall[0].length),
    );
    return titled ? titled[2] : null;
  }

  return null;
}

/**
 * Collect every `(scenario, test)` link declared by `// @scenario` comments.
 *
 * Suite-level annotations apply to the tests inside the block, scoped by
 * indentation. Anything an annotation cannot be resolved against is a hard
 * error with a `file:line` reference rather than a silent skip.
 */
export function scanTestAnnotations(file, content) {
  const lines = content.split('\n');
  const links = [];
  const suites = [];
  let pending = null;

  const fail = (line, message) => {
    throw new Error(`${file}:${line} — ${message}`);
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;

    const annotation = ANNOTATION.exec(line);
    if (annotation) {
      if (!pending) pending = { line: lineNumber, scenarioIds: [] };
      pending.scenarioIds.push(annotation[1]);
      continue;
    }

    if (BLANK_OR_COMMENT.test(line)) continue;

    const indent = /^\s*/.exec(line)[0].length;
    while (suites.length && indent <= suites[suites.length - 1].indent) {
      suites.pop();
    }

    const opener = TEST_OPENER.exec(line);
    if (!opener) {
      if (pending) fail(pending.line, 'annotation is not attached to a test');
      continue;
    }

    const [matched, , keyword, modifierChain] = opener;
    const modifiers = modifierChain.split('.').filter(Boolean);
    const isSuite = keyword === 'describe' || modifiers.includes('describe');
    const title = extractTitle(line.slice(matched.length), modifiers);

    if (pending && title === null) {
      fail(lineNumber, 'test title is not a plain string literal');
    }

    if (isSuite) {
      suites.push({
        indent,
        scenarioIds: pending ? pending.scenarioIds : [],
        line: pending ? pending.line : lineNumber,
      });
      pending = null;
      continue;
    }

    const inherited = suites.flatMap((suite) => ({
      ids: suite.scenarioIds,
      line: suite.line,
    }));
    const own = pending
      ? [{ ids: pending.scenarioIds, line: pending.line }]
      : [];
    for (const group of [...inherited, ...own]) {
      for (const scenarioId of group.ids) {
        links.push({
          scenarioId,
          file,
          line: lineNumber,
          annotationLine: group.line,
          testTitle: title,
        });
      }
    }
    pending = null;
  }

  if (pending) fail(pending.line, 'annotation is not attached to a test');
  return links;
}

/** Escape the one character that would break a markdown table cell. */
function cell(text) {
  return String(text).replaceAll('|', '\\|');
}

/**
 * Render the committed coverage map: a summary table, the gap list, and every
 * scenario with its content hash and the tests covering it.
 */
export function renderCoverageMap(scenarios, links, exemptions) {
  const coveringTests = new Map();
  for (const link of links) {
    if (!coveringTests.has(link.scenarioId)) {
      coveringTests.set(link.scenarioId, []);
    }
    coveringTests.get(link.scenarioId).push(link);
  }

  const stateOf = (scenario) => {
    if (coveringTests.has(scenario.id)) return 'covered';
    return exemptions.has(scenario.id) ? 'exempt' : 'uncovered';
  };

  const capabilities = [...new Set(scenarios.map((s) => s.capability))].sort();
  const uncovered = scenarios.filter((s) => stateOf(s) === 'uncovered');
  const covered = scenarios.filter((s) => stateOf(s) === 'covered');
  const exempt = scenarios.filter((s) => stateOf(s) === 'exempt');

  const lines = [
    '# Scenario coverage',
    '',
    '<!-- Generated by scripts/spec-coverage.mjs — do not edit by hand. -->',
    '<!-- Regenerate with `npm run spec:coverage`. -->',
    '',
    `${scenarios.length} scenarios across ${capabilities.length} capabilities: ` +
      `${covered.length} covered, ${exempt.length} exempt, ${uncovered.length} uncovered.`,
    '',
    '## Summary',
    '',
    '| Capability | Scenarios | Covered | Exempt | Uncovered |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const capability of capabilities) {
    const own = scenarios.filter((s) => s.capability === capability);
    const count = (state) => own.filter((s) => stateOf(s) === state).length;
    lines.push(
      `| ${capability} | ${own.length} | ${count('covered')} | ${count('exempt')} | ${count('uncovered')} |`,
    );
  }

  lines.push('', '## Uncovered scenarios', '');
  if (uncovered.length === 0) {
    lines.push(
      'None — every scenario is covered by a test or explicitly exempt.',
    );
  } else {
    for (const scenario of uncovered) {
      lines.push(`- \`${scenario.id}\` (${scenario.requirement})`);
    }
  }

  for (const capability of capabilities) {
    lines.push(
      '',
      `## ${capability}`,
      '',
      '| Scenario | Requirement | Hash | Covered by |',
      '| --- | --- | --- | --- |',
    );

    for (const scenario of scenarios.filter(
      (s) => s.capability === capability,
    )) {
      const tests = coveringTests.get(scenario.id) ?? [];
      const coverage = tests.length
        ? tests
            .map((t) => `\`${cell(t.file)}\` — ${cell(t.testTitle)}`)
            .join('<br>')
        : exemptions.has(scenario.id)
          ? `_Exempt: ${cell(exemptions.get(scenario.id))}_`
          : '**none**';

      lines.push(
        `| ${cell(scenario.title)} | ${cell(scenario.requirement)} | \`${hashScenarioBody(scenario.body)}\` | ${coverage} |`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Expand exemption entries into a scenario -> reason map.
 *
 * Exemptions are self-policing: an entry naming a scenario that does not exist
 * cannot rot unnoticed, and an entry for a scenario a test already covers is
 * forced out rather than left to hide real coverage.
 */
export function resolveExemptions(entries, scenarioIds, annotatedIds) {
  const known = new Set(scenarioIds);
  const annotated = new Set(annotatedIds);
  const exemptions = new Map();

  for (const entry of entries) {
    const { scenario, reason } = entry;
    if (!reason || !reason.trim()) {
      throw new Error(`Exemption for ${scenario} has no stated reason.`);
    }

    const matches = scenario.endsWith('/*')
      ? scenarioIds.filter((id) => id.startsWith(scenario.slice(0, -1)))
      : known.has(scenario)
        ? [scenario]
        : [];

    if (matches.length === 0) {
      throw new Error(
        `Exemption names an unknown scenario: ${scenario}. Remove it or fix the identifier.`,
      );
    }

    for (const id of matches) {
      if (annotated.has(id)) {
        throw new Error(
          `Exempt scenario ${id} is covered by a test. Remove the exemption for it.`,
        );
      }
      exemptions.set(id, reason.trim());
    }
  }

  return exemptions;
}

/** Every file under `dir`, relative to `root`, with forward slashes. */
function walk(root, dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];

  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(root, path.join(entry.parentPath ?? entry.path, entry.name))
        .split(path.sep)
        .join('/'),
    )
    .sort();
}

/** Read the canonical specs, the test annotations and the exemption entries. */
export function collectFromDisk(root) {
  const specsRoot = path.join(root, SPECS_DIR);
  const capabilities = fs.existsSync(specsRoot)
    ? fs
        .readdirSync(specsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  const scenarios = capabilities.flatMap((capability) => {
    const specPath = path.join(specsRoot, capability, 'spec.md');
    if (!fs.existsSync(specPath)) return [];
    return parseSpecScenarios(capability, fs.readFileSync(specPath, 'utf8'));
  });

  const testFiles = [
    // Jest suites live next to the code, plus the tooling's own tests; the
    // Playwright layer is a flat directory of specs and helpers.
    ...[...walk(root, 'src'), ...walk(root, 'scripts')].filter(
      (file) => file.includes('/__tests__/') && /\.tsx?$/.test(file),
    ),
    ...walk(root, 'e2e').filter((file) => /\.tsx?$/.test(file)),
  ];

  const links = testFiles.flatMap((file) =>
    scanTestAnnotations(file, fs.readFileSync(path.join(root, file), 'utf8')),
  );

  const exemptionsPath = path.join(root, EXEMPTIONS_PATH);
  const exemptionEntries = fs.existsSync(exemptionsPath)
    ? JSON.parse(fs.readFileSync(exemptionsPath, 'utf8'))
    : [];

  return { scenarios, links, exemptionEntries };
}

/**
 * Run the tool.
 *
 * Returns an exit code and the text to print rather than exiting, so the
 * behaviour is testable. `--check` never writes; `--strict` turns an uncovered
 * scenario into a failure.
 */
export function main(argv, root) {
  const check = argv.includes('--check');
  const strict = argv.includes('--strict');
  const output = [];

  let scenarios;
  let links;
  let exemptions;
  try {
    const collected = collectFromDisk(root);
    scenarios = collected.scenarios;
    links = collected.links;

    const known = new Set(scenarios.map((scenario) => scenario.id));
    const dangling = links.filter((link) => !known.has(link.scenarioId));
    if (dangling.length) {
      for (const link of dangling) {
        output.push(
          `${link.file}:${link.annotationLine} — annotation cites unknown scenario ${link.scenarioId}`,
        );
      }
      output.push(
        'A scenario may have been renamed or removed. Update the annotation to match the spec.',
      );
      return { exitCode: 1, output: output.join('\n') };
    }

    exemptions = resolveExemptions(
      collected.exemptionEntries,
      [...known],
      links.map((link) => link.scenarioId),
    );
  } catch (error) {
    return { exitCode: 1, output: error.message };
  }

  const markdown = renderCoverageMap(scenarios, links, exemptions);
  const mapPath = path.join(root, MAP_PATH);
  let stale = false;

  if (check) {
    const current = fs.existsSync(mapPath)
      ? fs.readFileSync(mapPath, 'utf8')
      : null;
    if (current !== markdown) {
      stale = true;
      output.push(
        `${MAP_PATH} is out of date. Regenerate it with \`npm run spec:coverage\` and commit the result.`,
      );
    }
  } else {
    fs.mkdirSync(path.dirname(mapPath), { recursive: true });
    fs.writeFileSync(mapPath, markdown);
  }

  const covered = new Set(links.map((link) => link.scenarioId));
  const uncovered = scenarios.filter(
    (scenario) => !covered.has(scenario.id) && !exemptions.has(scenario.id),
  );

  if (uncovered.length) {
    const summary = `${uncovered.length} scenario(s) have no test and no exemption:`;
    if (strict) {
      output.push(summary, ...uncovered.map((s) => `  ${s.id}`));
    } else {
      output.push(`${summary} see ${MAP_PATH}.`);
    }
  }

  const failed = stale || (strict && uncovered.length > 0);
  return { exitCode: failed ? 1 : 0, output: output.join('\n') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = main(process.argv.slice(2), process.cwd());
  if (result.output) console.log(result.output);
  process.exit(result.exitCode);
}
