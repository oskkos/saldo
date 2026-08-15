-- A stored WORK entry must span a positive, bounded length of time.
--
-- The overlap read in `overlappingWorkEntries` derives its lower bound from the
-- upper limit stated here: a colliding entry ends after the submitted span begins
-- and spans at most a day, so it cannot begin more than a day before it. Without
-- this constraint no lower bound on that read could be proven safe.
--
-- Absences are exempt, and deliberately so. The overlap read filters them out
-- (`absence IS NULL`), so they play no part in the proof, and constraining them
-- would extend this migration's blast radius over rows nothing here depends on.
-- The DELETE below is scoped identically, so the two cannot disagree.
--
-- The two statements must stay in this order and in one migration. ADD CONSTRAINT
-- validates existing rows, so it fails on any database still holding a violator.
--
-- BEGIN/COMMIT are explicit and load-bearing. Prisma does NOT wrap a migration file
-- in a transaction: verified by seeding a database with both a zero-length row and
-- an over-long one, where the DELETE committed and stayed committed after the
-- ALTER failed. Without this the migration half-applies on exactly the database
-- that needs a human to look at it — rows deleted, constraint absent, migration
-- recorded as failed.
BEGIN;

-- Remove work entries that record no work. `to <= from` means the entry ends no
-- later than it starts, so there is no duration to preserve and any adjustment
-- would invent data that was never entered.
--
-- Rows spanning MORE than a day are deliberately left alone. They represent real
-- logged time, so the constraint below is allowed to fail on them rather than this
-- migration destroying them — a person decides what such an entry should have been.
DELETE FROM "Worklog"
WHERE absence IS NULL
  AND "to" <= "from";

ALTER TABLE "Worklog"
  ADD CONSTRAINT "Worklog_work_entry_span_positive_and_bounded"
  CHECK (
    absence IS NOT NULL
    OR ("to" > "from" AND "to" - "from" <= interval '1 day')
  );

COMMIT;
