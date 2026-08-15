import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Every worklog write now performs a bounded read to detect overlap, and the
// range reads that render the app filter the same way. Without the index both
// scan the user's whole history, and nothing else in the suite would notice —
// a mocked Prisma client answers the same either way, and no assertion about
// rendered output changes.
//
// What this can and cannot show: it asserts the index is declared over the
// columns the queries filter on, and (in the repository suite) that the queries
// do filter on them. Proving the planner actually chooses it would need EXPLAIN
// against a real database, which the unit layer does not have.
const schema = readFileSync(
  path.join(process.cwd(), 'prisma', 'schema.prisma'),
  'utf8',
);

const worklogModel = () => {
  const match = schema.match(/model Worklog \{([\s\S]*?)\n\}/);
  if (!match) {
    throw new Error('Worklog model not found in prisma/schema.prisma');
  }
  return match[1];
};

describe('the worklog index', () => {
  // @scenario data-load-performance/Overlap detection on write
  // @scenario data-load-performance/Range read for rendering
  it('covers the owning user and the start instant, in that order', () => {
    // Order matters: user_id first makes the index usable for a single user's
    // rows bounded by `from`, which is the shape both queries have.
    expect(worklogModel()).toMatch(/@@index\(\[user_id,\s*from\]\)/);
  });

  it('is declared on the worklog model itself', () => {
    // Guards against the index being moved to another model in a refactor and
    // the assertion above still passing on unrelated text.
    expect(schema).toContain('model Worklog');
    expect(worklogModel()).toContain('@@index');
  });
});
