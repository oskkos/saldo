import type {
  FieldError,
  FieldValues,
  Path,
  RegisterOptions,
  UseFormRegister,
} from 'react-hook-form';
import type { ReactElement } from 'react';

interface TextInputProps<T extends FieldValues> {
  label: string;
  type: string;
  name: Path<T>;
  options?: RegisterOptions<T, Path<T>>;
  error?: FieldError | undefined;
  register: UseFormRegister<T>;
  icon?: ReactElement;
  value?: string;
}

export function TextInput<T extends FieldValues>({
  label,
  type,
  name,
  options,
  error,
  register,
  icon,
}: TextInputProps<T>) {
  return (
    <>
      <label className="input input-bordered flex items-center gap-2 my-2">
        {icon}
        <input
          type={type}
          {...register(name, options)}
          placeholder={label}
          name={name}
          className="grow"
          autoComplete="off"
        />
      </label>
      {error && <div className="text-xs text-error ml-2">{error.message}</div>}
    </>
  );
}
