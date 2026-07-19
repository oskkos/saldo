import 'server-only';

import { prisma } from './prisma';
import * as Sentry from '@sentry/nextjs';

// Wake the Neon compute with one trivial query before a page issues its
// concurrent reads. On a scale-to-zero cold start this pays the ~1s wake a
// single time; the reads that follow then run against a warm compute and
// overlap, instead of each racing the cold wake and serializing at ~1s per
// connection. Reads no user data, so no session/ownership gate is needed.
export async function warmUpDb(): Promise<void> {
  await Sentry.startSpan(
    { name: 'warmUpDb', op: 'db.sql.prisma' },
    async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
  );
}
