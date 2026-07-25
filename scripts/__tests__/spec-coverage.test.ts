import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  hashScenarioBody,
  main,
  parseSpecScenarios,
  renderCoverageMap,
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
    write('scripts/spec-coverage.exemptions.json', '[]');
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

  // @scenario spec-test-traceability/Exempt scenario is not a gap
  it('passes under --strict once the gap is exempt', () => {
    write(
      'scripts/spec-coverage.exemptions.json',
      JSON.stringify([
        { scenario: 'demo/Beta happens', reason: 'manual only' },
      ]),
    );

    expect(main(['--strict'], root).exitCode).toBe(0);
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
  it('scans the playwright layer as well as the jest layer', () => {
    write(
      'e2e/demo.spec.ts',
      ['// @scenario demo/Beta happens', "test('covers beta', () => {});"].join(
        '\n',
      ),
    );

    expect(main(['--strict'], root).exitCode).toBe(0);
  });
});

describe('scanTestAnnotations with aliased test imports', () => {
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
