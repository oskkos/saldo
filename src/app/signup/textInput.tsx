import type {
  FieldError,
  RegisterOptions,
  UseFormRegister,
} from 'react-hook-form';
import type { SignupData } from '@/schemas/signupSchema';

interface TextInputProps {
  label: string;
  type: string;
  name: keyof SignupData;
  options?: RegisterOptions<SignupData, keyof SignupData>;
  error?: FieldError | undefined;
  register: UseFormRegister<SignupData>;
}

export const TextInput = ({
  label,
  type,
  name,
  options,
  error,
  register,
}: TextInputProps) => {
  return (
    <div>
      <span>{label}</span>
      <input
        type={type}
        {...register(name, options)}
        className="input input-bordered w-full"
      />
      {error && <span className="text-xs text-error">{error.message}</span>}
    </div>
  );
};
