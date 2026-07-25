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

/**
 * Extract every requirement from one capability's spec markdown.
 *
 * Requirements become identifiers here so end-to-end exemptions can name one.
 * Scenario ids deliberately stay requirement-free, so a scenario can still move
 * between requirements without breaking the annotations that cite it.
 */
export function parseSpecRequirements(capability, markdown) {
  const requirements = [];
  const seen = new Set();

  for (const line of markdown.split('\n')) {
    const match = REQUIREMENT_HEADING.exec(line);
    if (!match) continue;

    const name = match[1];
    const id = `${capability}/${name}`;
    if (seen.has(id)) {
      throw new Error(
        `Duplicate requirement name: ${id}. Requirement names must be unique within a capability.`,
      );
    }
    seen.add(id);
    requirements.push({ id, capability, name });
  }

  return requirements;
}

const ANNOTATION = /^\s*\/\/\s*@scenario\s+(\S.*?)\s*$/;
const BLANK_OR_COMMENT = /^\s*(?:\/\/|\/\*|\*|$)/;
const STRING_LITERAL = /^\s*(['"])((?:\\.|(?!\1).)*)\1/;
const BASE_OPENERS = ['it', 'test', 'describe'];
// `[^}]*` spans newlines, so multi-line import blocks are matched too.
const IMPORT_BLOCK = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g;

/**
 * Local names in this file that declare a test or suite, mapped to the base
 * function they came from.
 *
 * Playwright's setup convention renames the import (`import { test as setup }`),
 * and a scanner that only knew the base names would not recognize the resulting
 * test at all — producing no annotation, no error, and silently uncoverable
 * tests. Aliases are read from the file's own imports so that cannot happen.
 */
function testOpeners(content) {
  const openers = new Map(BASE_OPENERS.map((name) => [name, name]));

  for (const [, specifiers] of content.matchAll(IMPORT_BLOCK)) {
    for (const specifier of specifiers.split(',')) {
      const alias = /^\s*(\w+)\s+as\s+(\w+)\s*$/.exec(specifier);
      if (alias && BASE_OPENERS.includes(alias[1])) {
        openers.set(alias[2], alias[1]);
      }
    }
  }

  return openers;
}

/** Opener pattern for one file's set of local test names. */
function testOpenerPattern(openers) {
  // Longest first so one name cannot shadow a longer one that starts with it.
  const names = [...openers.keys()].sort((a, b) => b.length - a.length);
  return new RegExp(`^(\\s*)(${names.join('|')})((?:\\.\\w+)*)\\s*\\(`);
}

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
  const openers = testOpeners(content);
  const testOpener = testOpenerPattern(openers);
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

    const opener = testOpener.exec(line);
    if (!opener) {
      if (pending) fail(pending.line, 'annotation is not attached to a test');
      continue;
    }

    const [matched, , localName, modifierChain] = opener;
    const keyword = openers.get(localName);
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

export const E2E_DIR = 'e2e/';

/** Whether a covering test belongs to the browser layer. */
export function isE2eTest(file) {
  return file.startsWith(E2E_DIR);
}

/**
 * Resolve each requirement's end-to-end state.
 *
 * `e2e`            at least one scenario is covered by a Playwright test
 * `not-applicable` every scenario is scenario-exempt, so no coverage is possible
 * `exempt`         carries a written end-to-end exemption
 * `missing`        needs a browser test or a decision
 */
export function analyzeRequirements({
  requirements,
  scenarios,
  links,
  scenarioExemptions,
  e2eExemptions,
}) {
  const e2eCovered = new Set(
    links.filter((link) => isE2eTest(link.file)).map((link) => link.scenarioId),
  );

  return requirements.map((requirement) => {
    const own = scenarios.filter(
      (scenario) =>
        scenario.capability === requirement.capability &&
        scenario.requirement === requirement.name,
    );
    const exemption = e2eExemptions.get(requirement.id) ?? null;

    const hasE2e = own.some((scenario) => e2eCovered.has(scenario.id));
    const allExempt =
      own.length > 0 &&
      own.every((scenario) => scenarioExemptions.has(scenario.id));

    let state;
    if (hasE2e) state = 'e2e';
    else if (allExempt) state = 'not-applicable';
    else if (exemption) state = 'exempt';
    else state = 'missing';

    return {
      ...requirement,
      scenarioIds: own.map((scenario) => scenario.id),
      state,
      exemption,
    };
  });
}

/** Escape the one character that would break a markdown table cell. */
function cell(text) {
  return String(text).replaceAll('|', '\\|');
}

/**
 * Render the committed coverage map: a summary table, the gap list, and every
 * scenario with its content hash and the tests covering it.
 */
export function renderCoverageMap(
  scenarios,
  links,
  exemptions,
  requirementStates = [],
) {
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

  if (requirementStates.length) {
    const e2eCapabilities = [
      ...new Set(requirementStates.map((r) => r.capability)),
    ].sort();
    const missing = requirementStates.filter((r) => r.state === 'missing');

    lines.push(
      '',
      '## End-to-end coverage',
      '',
      'Each requirement needs one scenario covered by a Playwright test, or a stated exemption.',
      '',
      '| Capability | Requirements | End-to-end | Exempt | Missing |',
      '| --- | --- | --- | --- | --- |',
    );

    for (const capability of e2eCapabilities) {
      const own = requirementStates.filter((r) => r.capability === capability);
      // A requirement whose scenarios are all exempt cannot have coverage of
      // any kind, so it is not counted as something to decide.
      const decidable = own.filter((r) => r.state !== 'not-applicable');
      const count = (state) =>
        decidable.filter((r) => r.state === state).length;
      lines.push(
        `| ${capability} | ${decidable.length} | ${count('e2e')} | ${count('exempt')} | ${count('missing')} |`,
      );
    }

    lines.push('', '## Requirements without end-to-end coverage', '');
    if (missing.length === 0) {
      lines.push(
        'None — every requirement has end-to-end coverage or a stated exemption.',
      );
    } else {
      for (const requirement of missing) {
        lines.push(`- \`${requirement.id}\``);
      }
    }

    const exempt = requirementStates.filter((r) => r.state === 'exempt');
    if (exempt.length) {
      lines.push(
        '',
        '## End-to-end exemptions',
        '',
        '| Requirement | Category | Reason | Covered at |',
        '| --- | --- | --- | --- |',
      );
      for (const requirement of exempt) {
        const { category, reason, coveredAt } = requirement.exemption;
        lines.push(
          `| ${cell(requirement.id)} | \`${cell(category)}\` | ${cell(reason)} | ${coveredAt ? `\`${cell(coveredAt)}\`` : '—'} |`,
        );
      }
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

export const E2E_EXEMPTION_CATEGORIES = [
  'no-ui',
  'unit-appropriate',
  'external-dependency',
  'harness-cost',
];

/** Read the two-section exemptions file. */
export function parseExemptionsFile(json) {
  const parsed = JSON.parse(json);

  if (Array.isArray(parsed)) {
    throw new Error(
      `${EXEMPTIONS_PATH} must be an object with "scenarios" and "requirementsWithoutE2e" keys, not a bare array.`,
    );
  }

  return {
    scenarios: parsed.scenarios ?? [],
    requirementsWithoutE2e: parsed.requirementsWithoutE2e ?? [],
  };
}

/**
 * Expand end-to-end exemption entries into a requirement -> exemption map.
 *
 * `harness-cost` is the only category that asserts a judgement rather than a
 * fact about the requirement, so it must name the test that does cover it and
 * that file must exist — otherwise the claim is unfalsifiable.
 */
export function resolveE2eExemptions(
  entries,
  requirementIds,
  e2eCoveredRequirementIds,
  fileExists,
) {
  const known = new Set(requirementIds);
  const covered = new Set(e2eCoveredRequirementIds);
  const exemptions = new Map();

  for (const entry of entries) {
    const { requirement, category, reason, coveredAt } = entry;

    if (!known.has(requirement)) {
      throw new Error(
        `End-to-end exemption names an unknown requirement: ${requirement}. Remove it or fix the name.`,
      );
    }
    if (!E2E_EXEMPTION_CATEGORIES.includes(category)) {
      throw new Error(
        `End-to-end exemption for ${requirement} has an unrecognized category: ${category}. Use one of ${E2E_EXEMPTION_CATEGORIES.join(', ')}.`,
      );
    }
    if (!reason || !reason.trim()) {
      throw new Error(
        `End-to-end exemption for ${requirement} has no stated reason.`,
      );
    }
    if (category === 'harness-cost') {
      if (!coveredAt) {
        throw new Error(
          `End-to-end exemption for ${requirement} is harness-cost, so it must name the test that does cover it in "coveredAt".`,
        );
      }
      if (!fileExists(coveredAt)) {
        throw new Error(
          `End-to-end exemption for ${requirement} names a coveredAt file that does not exist: ${coveredAt}.`,
        );
      }
    }
    if (covered.has(requirement)) {
      throw new Error(
        `Requirement ${requirement} has end-to-end coverage. Remove its exemption.`,
      );
    }

    exemptions.set(requirement, {
      category,
      reason: reason.trim(),
      coveredAt,
    });
  }

  return exemptions;
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

  const readSpec = (capability) => {
    const specPath = path.join(specsRoot, capability, 'spec.md');
    return fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : null;
  };

  const scenarios = capabilities.flatMap((capability) => {
    const markdown = readSpec(capability);
    return markdown ? parseSpecScenarios(capability, markdown) : [];
  });

  const requirements = capabilities.flatMap((capability) => {
    const markdown = readSpec(capability);
    return markdown ? parseSpecRequirements(capability, markdown) : [];
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
  const exemptions = fs.existsSync(exemptionsPath)
    ? parseExemptionsFile(fs.readFileSync(exemptionsPath, 'utf8'))
    : { scenarios: [], requirementsWithoutE2e: [] };

  return {
    scenarios,
    requirements,
    links,
    exemptionEntries: exemptions.scenarios,
    e2eExemptionEntries: exemptions.requirementsWithoutE2e,
  };
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
  let requirements;
  let links;
  let exemptions;
  let e2eExemptions;
  try {
    const collected = collectFromDisk(root);
    scenarios = collected.scenarios;
    requirements = collected.requirements;
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

    // Which requirements already have browser coverage, so an exemption for one
    // of them can be rejected as superseded.
    const e2eCovered = new Set(
      links
        .filter((link) => isE2eTest(link.file))
        .map((link) => scenarios.find((s) => s.id === link.scenarioId))
        .filter(Boolean)
        .map((s) => `${s.capability}/${s.requirement}`),
    );
    e2eExemptions = resolveE2eExemptions(
      collected.e2eExemptionEntries,
      requirements.map((requirement) => requirement.id),
      [...e2eCovered],
      (file) => fs.existsSync(path.join(root, file)),
    );
  } catch (error) {
    return { exitCode: 1, output: error.message };
  }

  const requirementStates = analyzeRequirements({
    requirements,
    scenarios,
    links,
    scenarioExemptions: exemptions,
    e2eExemptions,
  });
  const markdown = renderCoverageMap(
    scenarios,
    links,
    exemptions,
    requirementStates,
  );
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

  // The second gate, on the same annotations: a requirement needs one of its
  // scenarios covered in the browser, or a written decision not to.
  const withoutE2e = requirementStates.filter(
    (requirement) => requirement.state === 'missing',
  );

  if (withoutE2e.length) {
    const summary = `${withoutE2e.length} requirement(s) have no end-to-end test and no exemption:`;
    if (strict) {
      output.push(
        summary,
        ...withoutE2e.map((requirement) => `  ${requirement.id}`),
        `Add a Playwright test covering one of the requirement's scenarios, or an entry under "requirementsWithoutE2e" in ${EXEMPTIONS_PATH}.`,
      );
    } else {
      output.push(`${summary} see ${MAP_PATH}.`);
    }
  }

  const failed =
    stale || (strict && (uncovered.length > 0 || withoutE2e.length > 0));
  return { exitCode: failed ? 1 : 0, output: output.join('\n') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = main(process.argv.slice(2), process.cwd());
  if (result.output) console.log(result.output);
  process.exit(result.exitCode);
}
