import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  analyzeRequirements,
  hashScenarioBody,
  main,
  parseExemptionsFile,
  parseSpecRequirements,
  parseSpecScenarios,
  renderCoverageMap,
  resolveE2eExemptions,
  resolveExemptions,
  scanTestAnnotations,
} from '../spec-coverage.mjs';

const SPEC = `# demo Specification

## Purpose
Something.

## Requirements

### Requirement: First requirement

Some requirement prose.

#### Scenario: Alpha happens

- **WHEN** a thing occurs
- **THEN** another thing follows

### Requirement: Second requirement

More prose.

#### Scenario: Beta happens

- **WHEN** something else occurs
- **THEN** a different thing follows
`;

describe('parseSpecScenarios', () => {
  // @scenario spec-test-traceability/Scenario resolved by capability and title
  it('identifies each scenario as capability/title', () => {
    const scenarios = parseSpecScenarios('demo', SPEC);

    expect(scenarios.map((s) => s.id)).toEqual([
      'demo/Alpha happens',
      'demo/Beta happens',
    ]);
  });

  it('captures the scenario body without the requirement prose', () => {
    const [alpha] = parseSpecScenarios('demo', SPEC);

    expect(alpha.body).toContain('a thing occurs');
    expect(alpha.body).not.toContain('Some requirement prose');
  });

  // @scenario spec-test-traceability/Scenario resolved by capability and title
  it('records the parent requirement without putting it in the id', () => {
    const [, beta] = parseSpecScenarios('demo', SPEC);

    expect(beta.requirement).toBe('Second requirement');
    expect(beta.id).toBe('demo/Beta happens');
  });

  // @scenario spec-test-traceability/Scenario resolved by capability and title
  it('gives a scenario the same id after it moves to another requirement', () => {
    const moved = SPEC.replace(
      '### Requirement: Second requirement\n\nMore prose.\n\n',
      '',
    );

    const ids = parseSpecScenarios('demo', moved).map((s) => s.id);

    expect(ids).toEqual(['demo/Alpha happens', 'demo/Beta happens']);
  });

  // @scenario spec-test-traceability/Duplicate titles in a capability are rejected
  it('rejects two scenarios sharing a title in one capability', () => {
    const duplicated = SPEC.replace('Beta happens', 'Alpha happens');

    expect(() => parseSpecScenarios('demo', duplicated)).toThrow(
      /duplicate scenario title.*demo\/Alpha happens/i,
    );
  });
});

describe('hashScenarioBody', () => {
  it('renders 12 lowercase hex characters', () => {
    expect(hashScenarioBody('- **WHEN** a thing\n- **THEN** another')).toMatch(
      /^[0-9a-f]{12}$/,
    );
  });

  // @scenario spec-test-traceability/Whitespace-only edit leaves the hash stable
  it('is stable when the body is reindented', () => {
    const original = '- **WHEN** a thing occurs\n- **THEN** another follows';
    const reindented =
      '  - **WHEN** a thing occurs\n    - **THEN** another follows';

    expect(hashScenarioBody(reindented)).toBe(hashScenarioBody(original));
  });

  // @scenario spec-test-traceability/Whitespace-only edit leaves the hash stable
  it('is stable when the body is rewrapped across lines', () => {
    const oneLine =
      '- **THEN** the scenario is recorded as covered by that test';
    const wrapped =
      '- **THEN** the scenario is recorded\n  as covered by that test';

    expect(hashScenarioBody(wrapped)).toBe(hashScenarioBody(oneLine));
  });

  it('changes when the wording changes', () => {
    expect(hashScenarioBody('- **THEN** it is covered')).not.toBe(
      hashScenarioBody('- **THEN** it is exempt'),
    );
  });
});

describe('scenario hashing over a whole spec', () => {
  // @scenario spec-test-traceability/Requirement prose edit leaves scenario hashes stable
  it('leaves scenario hashes untouched when only requirement prose changes', () => {
    const before = parseSpecScenarios('demo', SPEC);
    const after = parseSpecScenarios(
      'demo',
      SPEC.replace('Some requirement prose.', 'Completely rewritten prose.'),
    );

    expect(after.map((s) => hashScenarioBody(s.body))).toEqual(
      before.map((s) => hashScenarioBody(s.body)),
    );
  });

  // @scenario spec-test-traceability/Reworded scenario changes its hash
  it('changes one scenario hash when that scenario is reworded', () => {
    const before = parseSpecScenarios('demo', SPEC);
    const after = parseSpecScenarios(
      'demo',
      SPEC.replace('a thing occurs', 'a different thing occurs'),
    );

    expect(hashScenarioBody(after[0].body)).not.toBe(
      hashScenarioBody(before[0].body),
    );
    expect(hashScenarioBody(after[1].body)).toBe(
      hashScenarioBody(before[1].body),
    );
  });
});

describe('scanTestAnnotations', () => {
  // @scenario spec-test-traceability/Annotation links a test to a scenario
  it('links an annotated test to its scenario', () => {
    const source = [
      '// @scenario time-clock/Clock in when idle',
      "it('records the session start', () => {});",
    ].join('\n');

    expect(scanTestAnnotations('e2e/demo.spec.ts', source)).toEqual([
      {
        scenarioId: 'time-clock/Clock in when idle',
        file: 'e2e/demo.spec.ts',
        line: 2,
        annotationLine: 1,
        testTitle: 'records the session start',
      },
    ]);
  });

  // @scenario spec-test-traceability/Stacked annotations declare multiple scenarios
  it('links every scenario in a stack of annotations to the same test', () => {
    const source = [
      '// @scenario demo/Alpha happens',
      '// @scenario demo/Beta happens',
      "it('covers both', () => {});",
    ].join('\n');

    const links = scanTestAnnotations('src/x/__tests__/a.test.ts', source);

    expect(links.map((l) => l.scenarioId)).toEqual([
      'demo/Alpha happens',
      'demo/Beta happens',
    ]);
    expect(links.every((l) => l.testTitle === 'covers both')).toBe(true);
  });

  // @scenario spec-test-traceability/Suite-level annotation covers every test inside
  it('applies a describe annotation to every test inside the block', () => {
    const source = [
      '// @scenario demo/Alpha happens',
      "describe('a suite', () => {",
      "  it('first test', () => {});",
      "  it('second test', () => {});",
      '});',
      "it('outside test', () => {});",
    ].join('\n');

    const links = scanTestAnnotations('src/x/__tests__/a.test.ts', source);

    expect(links.map((l) => l.testTitle)).toEqual([
      'first test',
      'second test',
    ]);
  });

  // @scenario spec-test-traceability/Suite-level annotation covers every test inside
  // @scenario spec-test-traceability/Annotations work identically in both test layers
  it('applies a test.describe annotation to every test inside the block', () => {
    const source = [
      '// @scenario demo/Alpha happens',
      "test.describe('a suite', () => {",
      "  test('inner test', async () => {});",
      '});',
    ].join('\n');

    const links = scanTestAnnotations('e2e/demo.spec.ts', source);

    expect(links.map((l) => l.testTitle)).toEqual(['inner test']);
  });

  it('recognises a test declared with a modifier', () => {
    const source = [
      '// @scenario demo/Alpha happens',
      "it.each([1, 2])('handles %s', () => {});",
    ].join('\n');

    expect(scanTestAnnotations('src/x/__tests__/a.test.ts', source)).toEqual([
      expect.objectContaining({ testTitle: 'handles %s' }),
    ]);
  });

  // @scenario spec-test-traceability/Unattached annotation fails the run
  it('reports file and line for an annotation attached to nothing', () => {
    const source = [
      "it('an unrelated test', () => {});",
      '',
      '// @scenario demo/Alpha happens',
    ].join('\n');

    expect(() =>
      scanTestAnnotations('src/x/__tests__/a.test.ts', source),
    ).toThrow(/src\/x\/__tests__\/a\.test\.ts:3.*not attached to a test/i);
  });

  // @scenario spec-test-traceability/Unattached annotation fails the run
  it('reports file and line when an annotation precedes ordinary code', () => {
    const source = [
      '// @scenario demo/Alpha happens',
      'const helper = 1;',
      "it('a test', () => {});",
    ].join('\n');

    expect(() =>
      scanTestAnnotations('src/x/__tests__/a.test.ts', source),
    ).toThrow(/src\/x\/__tests__\/a\.test\.ts:1.*not attached to a test/i);
  });

  // @scenario spec-test-traceability/Non-literal test title fails the run
  it('reports file and line for a non-literal test title', () => {
    const source = [
      '// @scenario demo/Alpha happens',
      'it(`handles ${value}`, () => {});',
    ].join('\n');

    expect(() =>
      scanTestAnnotations('src/x/__tests__/a.test.ts', source),
    ).toThrow(/src\/x\/__tests__\/a\.test\.ts:2.*not a plain string literal/i);
  });

  it('ignores tests that carry no annotation', () => {
    const source = "it('unannotated', () => {});";

    expect(scanTestAnnotations('src/x/__tests__/a.test.ts', source)).toEqual(
      [],
    );
  });
});

describe('resolveExemptions', () => {
  const scenarioIds = [
    'demo/Alpha happens',
    'demo/Beta happens',
    'other/Gamma happens',
  ];

  // @scenario spec-test-traceability/Exempt scenario is not a gap
  it('resolves a scenario entry to its reason', () => {
    const entries = [
      { scenario: 'demo/Alpha happens', reason: 'not automatable' },
    ];

    expect(resolveExemptions(entries, scenarioIds, [])).toEqual(
      new Map([['demo/Alpha happens', 'not automatable']]),
    );
  });

  // @scenario spec-test-traceability/Wildcard exempts a whole capability
  it('expands a capability wildcard to every scenario in it', () => {
    const entries = [{ scenario: 'demo/*', reason: 'skill workflow' }];

    expect([...resolveExemptions(entries, scenarioIds, []).keys()]).toEqual([
      'demo/Alpha happens',
      'demo/Beta happens',
    ]);
  });

  // @scenario spec-test-traceability/Unknown exemption fails the run
  it('rejects an entry naming a scenario that does not exist', () => {
    const entries = [{ scenario: 'demo/Deleted scenario', reason: 'stale' }];

    expect(() => resolveExemptions(entries, scenarioIds, [])).toThrow(
      /unknown scenario.*demo\/Deleted scenario/i,
    );
  });

  // @scenario spec-test-traceability/Unknown exemption fails the run
  it('rejects a wildcard naming a capability that does not exist', () => {
    const entries = [{ scenario: 'ghost/*', reason: 'stale' }];

    expect(() => resolveExemptions(entries, scenarioIds, [])).toThrow(
      /unknown scenario.*ghost\/\*/i,
    );
  });

  // @scenario spec-test-traceability/Exemption superseded by a real test fails the run
  it('rejects an entry for a scenario a test already covers', () => {
    const entries = [
      { scenario: 'demo/Alpha happens', reason: 'not automatable' },
    ];

    expect(() =>
      resolveExemptions(entries, scenarioIds, ['demo/Alpha happens']),
    ).toThrow(/demo\/Alpha happens.*covered by a test.*remove/i);
  });

  it('rejects an entry with no stated reason', () => {
    const entries = [{ scenario: 'demo/Alpha happens', reason: '  ' }];

    expect(() => resolveExemptions(entries, scenarioIds, [])).toThrow(
      /reason/i,
    );
  });
});

describe('renderCoverageMap', () => {
  const scenarios = [
    {
      id: 'demo/Alpha happens',
      capability: 'demo',
      title: 'Alpha happens',
      requirement: 'First requirement',
      body: '- **THEN** alpha',
    },
    {
      id: 'demo/Beta happens',
      capability: 'demo',
      title: 'Beta happens',
      requirement: 'First requirement',
      body: '- **THEN** beta',
    },
    {
      id: 'other/Gamma happens',
      capability: 'other',
      title: 'Gamma happens',
      requirement: 'Another requirement',
      body: '- **THEN** gamma',
    },
  ];
  const links = [
    {
      scenarioId: 'demo/Alpha happens',
      file: 'src/x/__tests__/a.test.ts',
      line: 4,
      testTitle: 'does the thing',
    },
  ];
  const exemptions = new Map([['demo/Beta happens', 'not automatable']]);

  const render = () => renderCoverageMap(scenarios, links, exemptions);

  // @scenario spec-test-traceability/Map reports coverage per capability
  it('counts covered, exempt and uncovered per capability', () => {
    expect(render()).toContain('| demo | 2 | 1 | 1 | 0 |');
    expect(render()).toContain('| other | 1 | 0 | 0 | 1 |');
  });

  // @scenario spec-test-traceability/Map lists the tests covering each scenario
  it('lists the tests covering a scenario with its hash', () => {
    const markdown = render();

    expect(markdown).toContain(hashScenarioBody('- **THEN** alpha'));
    expect(markdown).toContain('src/x/__tests__/a.test.ts');
    expect(markdown).toContain('does the thing');
  });

  // @scenario spec-test-traceability/Exempt scenarios are shown with their reason
  it('shows an exempt scenario with its reason', () => {
    expect(render()).toMatch(/Beta happens.*not automatable/);
  });

  // @scenario spec-test-traceability/Map lists uncovered scenarios
  it('lists scenarios that have neither a test nor an exemption', () => {
    const markdown = render();
    const uncovered = markdown.slice(markdown.indexOf('## Uncovered'));

    expect(uncovered).toContain('other/Gamma happens');
    expect(uncovered).not.toContain('demo/Alpha happens');
  });

  it('names the regeneration command so the file is not hand-edited', () => {
    expect(render()).toContain('npm run spec:coverage');
  });
});

// Both demo requirements declared out of the end-to-end rule, for the tests
// whose subject is scenario coverage rather than the layer a test lives in.
const NO_E2E = {
  scenarios: [],
  requirementsWithoutE2e: [
    {
      requirement: 'demo/First requirement',
      category: 'no-ui',
      reason: 'nothing to click',
    },
    {
      requirement: 'demo/Second requirement',
      category: 'no-ui',
      reason: 'nothing to click',
    },
  ],
};

describe('main', () => {
  let root: string;

  const write = (relative: string, content: string) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };

  const mapPath = () => path.join(root, 'openspec/COVERAGE.md');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-coverage-'));
    write('openspec/specs/demo/spec.md', SPEC);
    write(
      'src/x/__tests__/a.test.ts',
      ['// @scenario demo/Alpha happens', "it('covers alpha', () => {});"].join(
        '\n',
      ),
    );
    // The fixture settles the requirement dimension, so tests about scenario
    // coverage are not also asserting the end-to-end rule by accident. The
    // tests that are about that rule write their own file.
    write('scripts/spec-coverage.exemptions.json', JSON.stringify(NO_E2E));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  // @scenario spec-test-traceability/Generate mode writes the map
  it('writes the coverage map in generate mode', () => {
    const result = main([], root);

    expect(result.exitCode).toBe(0);
    expect(fs.readFileSync(mapPath(), 'utf8')).toContain('demo/Beta happens');
  });

  // @scenario spec-test-traceability/Check mode does not write
  it('writes nothing in check mode', () => {
    const result = main(['--check'], root);

    expect(fs.existsSync(mapPath())).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  // @scenario spec-test-traceability/Stale committed map fails the check
  it('fails the check when the committed map is stale', () => {
    main([], root);
    fs.writeFileSync(mapPath(), '# Scenario coverage\n\nstale\n');

    const result = main(['--check'], root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('npm run spec:coverage');
  });

  it('passes the check when the committed map is current', () => {
    main([], root);

    expect(main(['--check'], root).exitCode).toBe(0);
  });

  // @scenario spec-test-traceability/Uncovered scenario fails CI
  it('fails under --strict when a scenario has no test and no exemption', () => {
    const result = main(['--strict'], root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('demo/Beta happens');
  });

  it('does not fail on an uncovered scenario without --strict', () => {
    expect(main([], root).exitCode).toBe(0);
  });

  // @scenario spec-test-traceability/Exemption for a requirement needing no decision fails the run
  it('fails when an end-to-end exemption names a requirement that needs no decision', () => {
    // Beta is the only scenario of the second requirement, so exempting it
    // leaves that requirement with nothing a browser test could ever cover.
    write(
      'scripts/spec-coverage.exemptions.json',
      JSON.stringify({
        scenarios: [
          { scenario: 'demo/Beta happens', reason: 'cannot be automated' },
        ],
        requirementsWithoutE2e: NO_E2E.requirementsWithoutE2e,
      }),
    );

    const result = main([], root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toMatch(/demo\/Second requirement/);
  });

  // @scenario spec-test-traceability/Exempt scenario is not a gap
  it('passes under --strict once the gap is exempt', () => {
    write(
      'scripts/spec-coverage.exemptions.json',
      JSON.stringify({
        scenarios: [{ scenario: 'demo/Beta happens', reason: 'manual only' }],
        // Only the first requirement needs an end-to-end decision here: Beta is
        // the second one's only scenario, and exempting it leaves that
        // requirement with nothing to decide.
        requirementsWithoutE2e: NO_E2E.requirementsWithoutE2e.filter(
          (entry) => entry.requirement === 'demo/First requirement',
        ),
      }),
    );

    expect(main(['--strict'], root).exitCode).toBe(0);
  });

  // @scenario spec-test-traceability/Requirement without end-to-end coverage fails CI
  it('fails under --strict when a requirement has no end-to-end test', () => {
    // Both scenarios covered, but only by Jest, so neither requirement has a
    // browser test behind it.
    write(
      'src/x/__tests__/b.test.ts',
      ['// @scenario demo/Beta happens', "it('covers beta', () => {});"].join(
        '\n',
      ),
    );
    write(
      'scripts/spec-coverage.exemptions.json',
      JSON.stringify({ scenarios: [], requirementsWithoutE2e: [] }),
    );

    const result = main(['--strict'], root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('demo/First requirement');
    expect(result.output).toContain('demo/Second requirement');
    expect(result.output).toContain('requirementsWithoutE2e');
  });

  // @scenario spec-test-traceability/Existing CI step picks up the rule
  // @scenario spec-test-traceability/Requirement covered by one end-to-end test
  it('evaluates scenario and requirement coverage in the same strict run', () => {
    write(
      'e2e/demo.spec.ts',
      ['// @scenario demo/Beta happens', "test('covers beta', () => {});"].join(
        '\n',
      ),
    );
    write(
      'scripts/spec-coverage.exemptions.json',
      JSON.stringify({
        scenarios: [],
        requirementsWithoutE2e: [
          {
            requirement: 'demo/First requirement',
            category: 'no-ui',
            reason: 'nothing to click',
          },
        ],
      }),
    );

    // One requirement covered by the Playwright test, the other exempt, and
    // every scenario covered — a single --strict run is satisfied by both.
    const result = main(['--strict'], root);

    expect(result.output).toBe('');
    expect(result.exitCode).toBe(0);
  });

  // @scenario spec-test-traceability/End-to-end exemption resolves the requirement
  it('passes under --strict once the end-to-end gap is exempt', () => {
    write(
      'src/x/__tests__/b.test.ts',
      ['// @scenario demo/Beta happens', "it('covers beta', () => {});"].join(
        '\n',
      ),
    );
    write(
      'scripts/spec-coverage.exemptions.json',
      JSON.stringify({
        scenarios: [],
        requirementsWithoutE2e: [
          {
            requirement: 'demo/First requirement',
            category: 'no-ui',
            reason: 'nothing to click',
          },
          {
            requirement: 'demo/Second requirement',
            category: 'unit-appropriate',
            reason: 'pinned precisely in the unit layer',
          },
        ],
      }),
    );

    expect(main(['--strict'], root).exitCode).toBe(0);
  });

  it('does not fail on a missing end-to-end test without --strict', () => {
    write(
      'src/x/__tests__/b.test.ts',
      ['// @scenario demo/Beta happens', "it('covers beta', () => {});"].join(
        '\n',
      ),
    );
    write(
      'scripts/spec-coverage.exemptions.json',
      JSON.stringify({ scenarios: [], requirementsWithoutE2e: [] }),
    );

    const result = main([], root);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('end-to-end test');
  });

  // @scenario spec-test-traceability/Annotation citing an unknown scenario fails the run
  // @scenario spec-test-traceability/Renaming a scenario breaks its annotations visibly
  it('fails on an annotation citing a scenario that does not exist', () => {
    write(
      'src/x/__tests__/a.test.ts',
      [
        '// @scenario demo/Renamed away',
        "it('covers nothing', () => {});",
      ].join('\n'),
    );

    const result = main([], root);

    expect(result.exitCode).toBe(1);
    expect(result.output).toMatch(
      /src\/x\/__tests__\/a\.test\.ts:1.*demo\/Renamed away/,
    );
  });

  it('scans the tooling tests under scripts as well', () => {
    write(
      'scripts/__tests__/tool.test.ts',
      ['// @scenario demo/Beta happens', "it('covers beta', () => {});"].join(
        '\n',
      ),
    );

    expect(main(['--strict'], root).exitCode).toBe(0);
  });

  // @scenario spec-test-traceability/Annotations work identically in both test layers
  // @scenario spec-test-traceability/Declaring the layer costs the author nothing
  it('scans the playwright layer as well as the jest layer', () => {
    // The same annotation the Jest fixture uses, moved to a Playwright path
    // and left otherwise untouched.
    write(
      'e2e/demo.spec.ts',
      ['// @scenario demo/Beta happens', "test('covers beta', () => {});"].join(
        '\n',
      ),
    );
    // Its requirement's exemption has to go: the annotation now counts as
    // end-to-end coverage purely because of where the file lives.
    write(
      'scripts/spec-coverage.exemptions.json',
      JSON.stringify({
        scenarios: [],
        requirementsWithoutE2e: [NO_E2E.requirementsWithoutE2e[0]],
      }),
    );

    expect(main(['--strict'], root).exitCode).toBe(0);
  });
});

describe('scanTestAnnotations with aliased test imports', () => {
  // @scenario spec-test-traceability/Aliased test function is recognized
  it('recognises a test declared through an aliased import', () => {
    const source = [
      "import { test as setup, expect } from '@playwright/test';",
      '',
      '// @scenario auth/Correct credentials',
      "setup('authenticate', async ({ page }) => {});",
    ].join('\n');

    expect(scanTestAnnotations('e2e/auth.setup.ts', source)).toEqual([
      expect.objectContaining({
        scenarioId: 'auth/Correct credentials',
        testTitle: 'authenticate',
        line: 4,
      }),
    ]);
  });

  // @scenario spec-test-traceability/Aliased test function is recognized
  it('treats an aliased describe as a suite covering the tests inside', () => {
    const source = [
      "import { describe as suite, it as spec } from '@jest/globals';",
      '',
      '// @scenario demo/Alpha happens',
      "suite('a suite', () => {",
      "  spec('inner test', () => {});",
      '});',
    ].join('\n');

    const links = scanTestAnnotations('src/x/__tests__/a.test.ts', source);

    expect(links.map((l) => l.testTitle)).toEqual(['inner test']);
  });

  it('reads aliases from a multi-line import declaration', () => {
    const source = [
      'import {',
      '  test as setup,',
      '  expect,',
      "} from '@playwright/test';",
      '',
      '// @scenario demo/Alpha happens',
      "setup('authenticate', async () => {});",
    ].join('\n');

    expect(scanTestAnnotations('e2e/auth.setup.ts', source)).toHaveLength(1);
  });

  it('does not treat an unrelated local of the same name as a test', () => {
    const source = [
      'const setup = () => {};',
      '',
      '// @scenario demo/Alpha happens',
      "setup('not a test', () => {});",
    ].join('\n');

    // Without an aliasing import, `setup` is just a function call — the
    // annotation is attached to nothing and must fail loudly.
    expect(() =>
      scanTestAnnotations('src/x/__tests__/a.test.ts', source),
    ).toThrow(/not attached to a test/i);
  });
});

describe('parseSpecRequirements', () => {
  // @scenario spec-test-traceability/Scenario resolved by capability and title
  it('identifies each requirement as capability/name', () => {
    expect(parseSpecRequirements('demo', SPEC)).toEqual([
      {
        id: 'demo/First requirement',
        capability: 'demo',
        name: 'First requirement',
      },
      {
        id: 'demo/Second requirement',
        capability: 'demo',
        name: 'Second requirement',
      },
    ]);
  });

  it('rejects two requirements sharing a name in one capability', () => {
    const duplicated = SPEC.replace(
      '### Requirement: Second requirement',
      '### Requirement: First requirement',
    );

    expect(() => parseSpecRequirements('demo', duplicated)).toThrow(
      /duplicate requirement name.*demo\/First requirement/i,
    );
  });

  it('ignores requirement-shaped text that is not a heading', () => {
    const withProse = SPEC.replace(
      'Some requirement prose.',
      'Mentions `### Requirement: Not a heading` inline.',
    );

    expect(parseSpecRequirements('demo', withProse)).toHaveLength(2);
  });
});

describe('analyzeRequirements', () => {
  const requirements = [
    { id: 'demo/Journey', capability: 'demo', name: 'Journey' },
    { id: 'demo/Rule', capability: 'demo', name: 'Rule' },
    { id: 'demo/Internal', capability: 'demo', name: 'Internal' },
  ];
  const scenarios = [
    { id: 'demo/A', capability: 'demo', requirement: 'Journey' },
    { id: 'demo/B', capability: 'demo', requirement: 'Journey' },
    { id: 'demo/C', capability: 'demo', requirement: 'Rule' },
    { id: 'demo/D', capability: 'demo', requirement: 'Internal' },
  ];
  const link = (scenarioId: string, file: string) => ({
    scenarioId,
    file,
    line: 1,
    annotationLine: 1,
    testTitle: 't',
  });

  const analyze = (options: Record<string, unknown> = {}) =>
    analyzeRequirements({
      requirements,
      scenarios,
      links: [],
      scenarioExemptions: new Map(),
      e2eExemptions: new Map(),
      ...options,
    });

  const stateOf = (result: { id: string; state: string }[], id: string) =>
    result.find((r) => r.id === id)?.state;

  // @scenario spec-test-traceability/Requirement covered by one end-to-end test
  // @scenario spec-test-traceability/Layer read from the test's path
  it('marks a requirement covered when any scenario has an e2e test', () => {
    const result = analyze({
      links: [link('demo/B', 'e2e/demo.spec.ts')],
    });

    expect(stateOf(result, 'demo/Journey')).toBe('e2e');
  });

  // @scenario spec-test-traceability/Unit-only requirement is reported as a gap
  // @scenario spec-test-traceability/Layer read from the test's path
  it('does not count a unit test as end-to-end coverage', () => {
    const result = analyze({
      links: [link('demo/C', 'src/x/__tests__/a.test.ts')],
    });

    expect(stateOf(result, 'demo/Rule')).toBe('missing');
  });

  // @scenario spec-test-traceability/Fully exempt requirement needs no end-to-end decision
  it('needs no decision when every scenario is already exempt', () => {
    const result = analyze({
      scenarioExemptions: new Map([['demo/D', 'no app code path']]),
    });

    expect(stateOf(result, 'demo/Internal')).toBe('not-applicable');
  });

  // @scenario spec-test-traceability/Unit-only requirement is reported as a gap
  it('treats a partially exempt requirement as still needing a decision', () => {
    const result = analyze({
      scenarioExemptions: new Map([['demo/A', 'no app code path']]),
    });

    expect(stateOf(result, 'demo/Journey')).toBe('missing');
  });

  // @scenario spec-test-traceability/End-to-end exemption resolves the requirement
  it('resolves a requirement that carries an e2e exemption', () => {
    const result = analyze({
      e2eExemptions: new Map([
        ['demo/Rule', { category: 'unit-appropriate', reason: 'pinned lower' }],
      ]),
    });

    expect(stateOf(result, 'demo/Rule')).toBe('exempt');
  });

  it('reports the exemption alongside the requirement', () => {
    const entry = { category: 'unit-appropriate', reason: 'pinned lower' };
    const result = analyze({ e2eExemptions: new Map([['demo/Rule', entry]]) });

    expect(
      result.find((r: { id: string }) => r.id === 'demo/Rule')?.exemption,
    ).toEqual(entry);
  });
});

describe('renderCoverageMap end-to-end section', () => {
  const scenarios = [
    {
      id: 'demo/A',
      capability: 'demo',
      title: 'A',
      requirement: 'Journey',
      body: '- **THEN** a',
    },
    {
      id: 'demo/C',
      capability: 'demo',
      title: 'C',
      requirement: 'Rule',
      body: '- **THEN** c',
    },
    {
      id: 'other/E',
      capability: 'other',
      title: 'E',
      requirement: 'Elsewhere',
      body: '- **THEN** e',
    },
  ];
  const links = [
    {
      scenarioId: 'demo/A',
      file: 'e2e/demo.spec.ts',
      line: 1,
      annotationLine: 1,
      testTitle: 'journey works',
    },
  ];
  const requirementStates = [
    {
      id: 'demo/Journey',
      capability: 'demo',
      name: 'Journey',
      state: 'e2e',
      exemption: null,
    },
    {
      id: 'demo/Rule',
      capability: 'demo',
      name: 'Rule',
      state: 'exempt',
      exemption: {
        category: 'unit-appropriate',
        reason: 'pinned exactly at the service layer',
      },
    },
    {
      id: 'other/Elsewhere',
      capability: 'other',
      name: 'Elsewhere',
      state: 'missing',
      exemption: null,
    },
  ];

  const render = () =>
    renderCoverageMap(scenarios, links, new Map(), requirementStates);

  // @scenario spec-test-traceability/Map counts end-to-end coverage per capability
  it('counts end-to-end coverage per capability', () => {
    const markdown = render();

    // capability | requirements | e2e | exempt | missing
    expect(markdown).toContain('| demo | 2 | 1 | 1 | 0 |');
    expect(markdown).toContain('| other | 1 | 0 | 0 | 1 |');
  });

  // @scenario spec-test-traceability/Map lists requirements without end-to-end coverage
  it('lists requirements that have no end-to-end coverage', () => {
    const markdown = render();
    const section = markdown.slice(
      markdown.indexOf('## Requirements without end-to-end coverage'),
    );

    expect(section).toContain('other/Elsewhere');
    expect(section).not.toContain('demo/Journey');
  });

  // @scenario spec-test-traceability/Map shows the category behind each exemption
  it('shows the category and reason behind an exempt requirement', () => {
    expect(render()).toMatch(
      /demo\/Rule.*unit-appropriate.*pinned exactly at the service layer/,
    );
  });

  it('reports none missing when every requirement is resolved', () => {
    const resolved = requirementStates.filter((r) => r.state !== 'missing');

    expect(renderCoverageMap(scenarios, links, new Map(), resolved)).toContain(
      'None — every requirement has end-to-end coverage or a stated exemption.',
    );
  });
});

describe('parseExemptionsFile', () => {
  it('reads the scenario and requirement sections', () => {
    const parsed = parseExemptionsFile(
      JSON.stringify({
        scenarios: [{ scenario: 'demo/A', reason: 'why' }],
        requirementsWithoutE2e: [
          { requirement: 'demo/Rule', category: 'no-ui', reason: 'why' },
        ],
      }),
    );

    expect(parsed.scenarios).toHaveLength(1);
    expect(parsed.requirementsWithoutE2e).toHaveLength(1);
  });

  it('defaults a missing section to empty', () => {
    const parsed = parseExemptionsFile(JSON.stringify({ scenarios: [] }));

    expect(parsed.requirementsWithoutE2e).toEqual([]);
  });

  it('rejects the old bare-array shape with a migration hint', () => {
    expect(() => parseExemptionsFile('[]')).toThrow(/scenarios/i);
  });
});

describe('resolveE2eExemptions', () => {
  const requirementIds = ['demo/Journey', 'demo/Rule'];
  const resolve = (
    entries: Record<string, unknown>[],
    covered: string[] = [],
    existingFiles: string[] = ['src/x/__tests__/a.test.ts'],
    notApplicable: string[] = [],
  ) =>
    resolveE2eExemptions(
      entries,
      requirementIds,
      covered,
      (file: string) => existingFiles.includes(file),
      notApplicable,
    );

  // @scenario spec-test-traceability/Exemption records a category and a reason
  it('resolves an entry to its category and reason', () => {
    const result = resolve([
      {
        requirement: 'demo/Rule',
        category: 'unit-appropriate',
        reason: 'lower',
      },
    ]);

    expect(result.get('demo/Rule')).toEqual({
      category: 'unit-appropriate',
      reason: 'lower',
      coveredAt: undefined,
    });
  });

  // @scenario spec-test-traceability/Exemption records a category and a reason
  it('accepts every defined category', () => {
    for (const category of [
      'no-ui',
      'unit-appropriate',
      'external-dependency',
    ]) {
      expect(() =>
        resolve([{ requirement: 'demo/Rule', category, reason: 'why' }]),
      ).not.toThrow();
    }
  });

  // @scenario spec-test-traceability/Unrecognized category is rejected
  it('rejects a category outside the defined set', () => {
    expect(() =>
      resolve([
        { requirement: 'demo/Rule', category: 'deferred', reason: 'later' },
      ]),
    ).toThrow(/category.*deferred/i);
  });

  // @scenario spec-test-traceability/Exemption without a reason is rejected
  it('rejects an entry with no reason', () => {
    expect(() =>
      resolve([{ requirement: 'demo/Rule', category: 'no-ui', reason: '  ' }]),
    ).toThrow(/reason/i);
  });

  // @scenario spec-test-traceability/Cost-based exemption must point at real coverage
  it('requires a covering test for a harness-cost exemption', () => {
    expect(() =>
      resolve([
        {
          requirement: 'demo/Rule',
          category: 'harness-cost',
          reason: 'too costly',
        },
      ]),
    ).toThrow(/coveredAt/i);
  });

  // @scenario spec-test-traceability/Pointer to a missing file is rejected
  it('rejects a harness-cost pointer to a file that does not exist', () => {
    expect(() =>
      resolve([
        {
          requirement: 'demo/Rule',
          category: 'harness-cost',
          reason: 'too costly',
          coveredAt: 'src/x/__tests__/gone.test.ts',
        },
      ]),
    ).toThrow(/gone\.test\.ts/);
  });

  it('accepts a harness-cost exemption naming a real file', () => {
    const result = resolve([
      {
        requirement: 'demo/Rule',
        category: 'harness-cost',
        reason: 'too costly',
        coveredAt: 'src/x/__tests__/a.test.ts',
      },
    ]);

    expect(result.get('demo/Rule')?.coveredAt).toBe(
      'src/x/__tests__/a.test.ts',
    );
  });

  // @scenario spec-test-traceability/Other categories need no pointer
  it('does not require a pointer for other categories', () => {
    expect(() =>
      resolve([{ requirement: 'demo/Rule', category: 'no-ui', reason: 'why' }]),
    ).not.toThrow();
  });

  // @scenario spec-test-traceability/Exemption for an unknown requirement fails the run
  // @scenario spec-test-traceability/Renaming a requirement breaks its exemption visibly
  it('rejects an entry naming a requirement that does not exist', () => {
    expect(() =>
      resolve([
        { requirement: 'demo/Renamed', category: 'no-ui', reason: 'why' },
      ]),
    ).toThrow(/unknown requirement.*demo\/Renamed/i);
  });

  // @scenario spec-test-traceability/Exemption superseded by end-to-end coverage fails the run
  it('rejects an entry for a requirement that already has e2e coverage', () => {
    expect(() =>
      resolve(
        [{ requirement: 'demo/Journey', category: 'no-ui', reason: 'why' }],
        ['demo/Journey'],
      ),
    ).toThrow(/demo\/Journey.*end-to-end.*remove/i);
  });

  // @scenario spec-test-traceability/Duplicate exemption entries for one requirement fail the run
  it('rejects two entries naming the same requirement', () => {
    expect(() =>
      resolve([
        { requirement: 'demo/Rule', category: 'no-ui', reason: 'first' },
        {
          requirement: 'demo/Rule',
          category: 'unit-appropriate',
          reason: 'second',
        },
      ]),
    ).toThrow(/demo\/Rule.*more than once/i);
  });

  // @scenario spec-test-traceability/Exemption for a requirement needing no decision fails the run
  it('rejects an entry for a requirement whose scenarios are all scenario-exempt', () => {
    expect(() =>
      resolve(
        [{ requirement: 'demo/Rule', category: 'no-ui', reason: 'why' }],
        [],
        ['src/x/__tests__/a.test.ts'],
        ['demo/Rule'],
      ),
    ).toThrow(/demo\/Rule.*no end-to-end decision/i);
  });
});
