import { describe, expect, test, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';

import Checkbox from '../checkbox';

describe('Checkbox', () => {
  test('should render the label', () => {
    const { getByText } = render(<Checkbox label="test" />);
    expect(getByText('test')).toBeInTheDocument();
  });

  test('should call the onChange function when the checkbox is changed', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <Checkbox label="test" onChange={onChange} />,
    );
    fireEvent.click(getByLabelText('test'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('should be checked when checked is true', () => {
    const { getByLabelText } = render(<Checkbox label="test" checked />);
    expect(getByLabelText('test')).toBeChecked();
  });
});
