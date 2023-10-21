import { describe, expect, test, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';

import DateInput from '../dateInput';
import { Date_ISODay } from '@/util/dateFormatter';

const isoDay = '2022-02-22' as Date_ISODay;

describe('DateInput', () => {
  test('renders without crashing', () => {
    const { container } = render(
      <DateInput
        label="Date of Birth"
        value={isoDay}
        placeholder="MM/DD/YYYY"
      />,
    );
    expect(container).toBeInTheDocument();
  });

  test('renders the label', () => {
    const { getByText } = render(
      <DateInput
        label="Date of Birth"
        value={isoDay}
        placeholder="MM/DD/YYYY"
      />,
    );
    expect(getByText('Date of Birth')).toBeInTheDocument();
  });

  test('renders without label', () => {
    const { getByPlaceholderText } = render(
      <DateInput value={isoDay} placeholder="MM/DD/YYYY" />,
    );
    expect(getByPlaceholderText('MM/DD/YYYY')).toBeInTheDocument();
  });

  test('renders the input field', () => {
    const { getByPlaceholderText } = render(
      <DateInput
        label="Date of Birth"
        value={isoDay}
        placeholder="MM/DD/YYYY"
      />,
    );
    expect(getByPlaceholderText('MM/DD/YYYY')).toBeInTheDocument();
  });

  test('calls the onChange function with a valid date', () => {
    const handleChange = jest.fn();
    const { getByPlaceholderText } = render(
      <DateInput
        label="Date of Birth"
        value={isoDay}
        placeholder="MM/DD/YYYY"
        onChange={handleChange}
      />,
    );
    const input = getByPlaceholderText('MM/DD/YYYY');
    fireEvent.change(input, { target: { value: '2022-03-03' } });
    expect(handleChange).toHaveBeenCalledWith('2022-03-03');
  });

  test('calls the onChange function without arguments with an invalid date', () => {
    const handleChange = jest.fn();
    const { getByPlaceholderText } = render(
      <DateInput
        label="Date of Birth"
        value={isoDay}
        placeholder="MM/DD/YYYY"
        onChange={handleChange}
      />,
    );

    const input = getByPlaceholderText('MM/DD/YYYY');
    fireEvent.change(input, { target: { value: 'non-date' } });
    expect(handleChange).toHaveBeenCalledWith();
  });
});
