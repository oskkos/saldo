import { FieldValues, Path, UseFormSetError } from 'react-hook-form';

export function handleFormFieldErrors<T extends FieldValues>(
  errors: { [k: string]: string },
  setError: UseFormSetError<T>,
  knwonFields: { [k: string]: Path<T> },
) {
  Object.keys(errors).forEach((field) => {
    if (!knwonFields[field]) {
      return;
    }
    setError(knwonFields[field], {
      type: 'server',
      message: errors[field],
    });
  });
}
