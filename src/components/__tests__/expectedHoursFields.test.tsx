import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ExpectedHoursFields from '../expectedHoursFields';

// Shared by the settings default, the "Special days" add form and the day-view
// override modal. The label input appears only for the callers that pass onLabel, and
// the empty-string fallback matters: a cleared field must report '' rather than a
// number, or a half-typed value would be saved as hours.

const noop = jest.fn();

describe('ExpectedHoursFields', () => {
  it('offers hours and minutes', () => {
    render(
      <ExpectedHoursFields hours={7} mins={30} onHours={noop} onMins={noop} />,
    );

    expect(screen.getByDisplayValue('7')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
  });

  it('omits the label field unless the caller wants one', () => {
    const { unmount } = render(
      <ExpectedHoursFields hours={7} mins={30} onHours={noop} onMins={noop} />,
    );
    expect(
      screen.queryByPlaceholderText('Label (optional)'),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <ExpectedHoursFields
        hours={7}
        mins={30}
        onHours={noop}
        onMins={noop}
        onLabel={noop}
      />,
    );
    expect(screen.getByPlaceholderText('Label (optional)')).toBeInTheDocument();
  });

  it('reports a label as it is typed', async () => {
    const onLabel = jest.fn<(val: string) => void>();
    render(
      <ExpectedHoursFields
        hours={7}
        mins={30}
        onHours={noop}
        onMins={noop}
        onLabel={onLabel}
      />,
    );

    await userEvent
      .setup()
      .type(screen.getByPlaceholderText('Label (optional)'), 'M');

    expect(onLabel).toHaveBeenCalledWith('M');
  });

  it('reports a cleared field as empty rather than as a number', async () => {
    const onHours = jest.fn<(val: number | '') => void>();
    render(
      <ExpectedHoursFields
        hours={7}
        mins={30}
        onHours={onHours}
        onMins={noop}
      />,
    );

    await userEvent.setup().clear(screen.getByDisplayValue('7'));

    expect(onHours).toHaveBeenCalledWith('');
  });
});
