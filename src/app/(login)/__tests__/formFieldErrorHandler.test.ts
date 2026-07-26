import { describe, it, expect, jest } from '@jest/globals';
import type { Path, UseFormSetError } from 'react-hook-form';

import { handleFormFieldErrors } from '../formFieldErrorHandler';

// Server-side validation returns errors keyed by field name, and this is what puts
// them back on the form. The guard against an unknown key is the interesting half:
// react-hook-form's setError on a field that does not exist would attach an error
// nothing renders, so the message would vanish rather than be shown.

type Form = { email: string };
type Setter = UseFormSetError<Form>;

const knownFields: { [k: string]: Path<Form> } = { email: 'email' };

describe('handleFormFieldErrors', () => {
  it('puts a server error on the field it names', () => {
    const setError = jest.fn<Setter>();

    handleFormFieldErrors<Form>(
      { email: 'Already taken' },
      setError,
      knownFields,
    );

    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'Already taken',
    });
  });

  it('ignores an error naming a field the form does not have', () => {
    const setError = jest.fn<Setter>();

    handleFormFieldErrors<Form>({ mystery: 'nope' }, setError, knownFields);

    expect(setError).not.toHaveBeenCalled();
  });

  it('applies every recognised field in one pass', () => {
    type TwoFields = { email: string; name: string };
    const setError = jest.fn<UseFormSetError<TwoFields>>();

    handleFormFieldErrors<TwoFields>(
      { email: 'Already taken', name: 'Required', mystery: 'nope' },
      setError,
      { email: 'email', name: 'name' },
    );

    expect(setError).toHaveBeenCalledTimes(2);
  });
});
