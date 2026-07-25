import { describe, it, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import AbsenceIcon from '../absenceIcon';
import { AbsenceReason } from '@/types';

const iconFor = (absence: AbsenceReason) => {
  const { container } = render(<AbsenceIcon absence={absence} />);
  const svg = container.querySelector('svg');
  return { svg, title: svg?.querySelector('title')?.textContent };
};

describe('AbsenceIcon', () => {
  // @scenario absence/Icon per reason
  it('renders a distinct icon for every reason', () => {
    const icons = [
      AbsenceReason.holiday,
      AbsenceReason.flex_hours,
      AbsenceReason.sick_leave,
      AbsenceReason.other,
    ].map((reason) => iconFor(reason));

    for (const { svg } of icons) {
      expect(svg).not.toBeNull();
    }
    // Distinct reasons must not collapse onto the same glyph.
    const paths = icons.map(({ svg }) => svg?.innerHTML);
    expect(new Set(paths).size).toBe(icons.length);
  });

  // @scenario absence/Icon per reason
  it('labels each icon with its human-readable reason', () => {
    expect(iconFor(AbsenceReason.holiday).title).toBe('Holiday');
    expect(iconFor(AbsenceReason.flex_hours).title).toBe('Flex hours');
    expect(iconFor(AbsenceReason.sick_leave).title).toBe('Sick leave');
    expect(iconFor(AbsenceReason.other).title).toBe('Other');
  });
});
