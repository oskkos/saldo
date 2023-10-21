import { describe, expect, test, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';

import TimeInput from '../timeInput';
import { Date_Time } from '@/util/dateFormatter';

const time = '12:30' as Date_Time;

describe('TimeInput', () => {
  test('renders without crashing', () => {
    const { container } = render(
      <TimeInput label="Time" value={time} placeholder="hh:mm" />,
    );
    expect(container).toBeInTheDocument();
  });

  test('renders without a label', () => {
    const { getByPlaceholderText } = render(
      <TimeInput value={time} placeholder="hh:mm" />,
    );
    expect(getByPlaceholderText('hh:mm')).toBeInTheDocument();
  });

  test('renders with a label', () => {
    const { getByText } = render(
      <TimeInput label="Time" value={time} placeholder="hh:mm" />,
    );
    expect(getByText('Time')).toBeInTheDocument();
  });

  test('renders an input field', () => {
    const { getByPlaceholderText } = render(
      <TimeInput label="Time" value={time} placeholder="hh:mm" />,
    );
    expect(getByPlaceholderText('hh:mm')).toBeInTheDocument();
  });

  test('changes the input value', () => {
    const handleChange = jest.fn();
    const { getByPlaceholderText } = render(
      <TimeInput
        label="Time"
        value={time}
        placeholder="hh:mm"
        onChange={handleChange}
      />,
    );

    fireEvent.change(getByPlaceholderText('hh:mm'), {
      target: { value: '13:30' },
    });
    expect(handleChange).toHaveBeenCalledWith('13:30');
  });

  test('calls the onChange function without arguments with an invalid date', () => {
    const handleChange = jest.fn();
    const { getByPlaceholderText } = render(
      <TimeInput
        label="Time"
        value={time}
        placeholder="hh:mm"
        onChange={handleChange}
      />,
    );

    fireEvent.change(getByPlaceholderText('hh:mm'), {
      target: { value: 'non-time' },
    });
    expect(handleChange).toHaveBeenCalledWith();
  });
});
