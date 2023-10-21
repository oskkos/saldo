import { describe, expect, test, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';

import IntegerInput from '../integerInput';

describe('IntegerInput', () => {
  test('renders without crashing', () => {
    const { container } = render(
      <IntegerInput label="Age" value={22} placeholder="Enter your age" />,
    );
    expect(container).toBeInTheDocument();
  });

  test('renders without label', () => {
    const { getByPlaceholderText } = render(
      <IntegerInput label="" value={22} placeholder="Enter your age" />,
    );
    expect(getByPlaceholderText('Enter your age')).toBeInTheDocument();
  });

  test('renders with a label', () => {
    const { getByText } = render(
      <IntegerInput label="Age" value={22} placeholder="Enter your age" />,
    );
    expect(getByText('Age')).toBeInTheDocument();
  });

  test('renders an input field', () => {
    const { getByPlaceholderText } = render(
      <IntegerInput label="Age" value={22} placeholder="Enter your age" />,
    );
    expect(getByPlaceholderText('Enter your age')).toBeInTheDocument();
  });

  test('changes the input value', () => {
    const handleChange = jest.fn();
    const { getByPlaceholderText } = render(
      <IntegerInput
        label="Age"
        value={22}
        placeholder="Enter your age"
        onChange={handleChange}
      />,
    );

    fireEvent.change(getByPlaceholderText('Enter your age'), {
      target: { value: '23' },
    });
    expect(handleChange).toHaveBeenCalledWith(23);
  });

  test('changes the input value to empty', () => {
    const handleChange = jest.fn();
    const { getByPlaceholderText } = render(
      <IntegerInput
        label="Age"
        value={22}
        placeholder="Enter your age"
        onChange={handleChange}
      />,
    );

    fireEvent.change(getByPlaceholderText('Enter your age'), {
      target: { value: '' },
    });
    expect(handleChange).toHaveBeenCalledWith();
  });
});
