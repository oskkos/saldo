import { Worklog } from '@prisma/client';

export default function ExistingWorklogs({
  worklogs,
}: {
  worklogs: Worklog[];
}) {
  return (
    <div>{worklogs.length ? <h3>Existing worklogs for day:</h3> : null}</div>
  );
}
