import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { AbsenceReason, type Worklog } from '@/types';

import WorklogTitle from '../worklogTitle';

// The title is the whole of what a row says about itself, and it says three different
// things: an absence names its reason, a worked entry shows its hours, and a lunch
// break is marked with an icon and nothing else. The lunch marker is the one a user
// would miss — it is the difference between 7.5 and 8 hours counted.

const worklog = (overrides: Partial<Worklog> = {}): Worklog => ({
  id: 1,
  from: new Date('2026-07-26T08:00:00Z'),
  to: new Date('2026-07-26T16:00:00Z'),
  subtractLunchBreak: false,
  absence: null,
  comment: null,
  ...overrides,
});

describe('WorklogTitle', () => {
  it('shows the hours worked', () => {
    const { container } = render(<WorklogTitle worklog={worklog()} />);

    expect(screen.getByText('08:00 - 16:00')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('marks an entry whose lunch break was deducted', () => {
    const { container } = render(
      <WorklogTitle worklog={worklog({ subtractLunchBreak: true })} />,
    );

    expect(screen.getByText('08:00 - 16:00')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('names the reason instead of hours for an absence', () => {
    render(
      <WorklogTitle worklog={worklog({ absence: AbsenceReason.sick_leave })} />,
    );

    expect(screen.queryByText('08:00 - 16:00')).not.toBeInTheDocument();
    // The reason wording comes from the service that maps the enum to words.
    expect(screen.getByRole('heading')).toHaveTextContent(/sick/i);
  });
});
