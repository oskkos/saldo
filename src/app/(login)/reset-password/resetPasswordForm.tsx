'use client';

import type { ReactNode } from 'react';
import { TextInput } from '@/components/form/textInput';
import {
  ResetPasswordData,
  ResetPasswordDataFields,
  resetPasswordSchemaResolver,
} from '@/schemas/resetPasswordSchema';
import { useForm, UseFormSetError } from 'react-hook-form';
import { MdLock } from 'react-icons/md';
import { handleFormFieldErrors } from '../formFieldErrorHandler';
import { onResetPassword } from '@/actions';

const successMsg = (
  <>
    <span>Password reset successfully!</span>{' '}
    <a href="/signin" className="font-medium hover:underline">
      Login here
    </a>
  </>
);

const onSubmit = async (
  data: ResetPasswordData,
  onSuccess: (msg: ReactNode) => void,
  onError: (msg: ReactNode) => void,
  setError: UseFormSetError<ResetPasswordData>,
) => {
  try {
    const ret = await onResetPassword(data);

    if (ret.status === 'success') {
      onSuccess(successMsg);
    }
    if (ret.status === 'error') {
      handleFormFieldErrors(
        ret.errors ?? {},
        setError,
        ResetPasswordDataFields,
      );
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'An error occurred.';
    onError(err);
  }
};

export function ResetPasswordForm({
  token,
  onSuccess,
  onError,
}: {
  token: string;
  onSuccess: (msg: ReactNode) => void;
  onError: (msg: ReactNode) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ResetPasswordData>({
    resolver: resetPasswordSchemaResolver,
  });

  return (
    <div className="flex flex-col items-center">
      <div className="mt-4 mb-2">Reset password</div>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSubmit={handleSubmit((data) => {
          void onSubmit(data, onSuccess, onError, setError);
        })}
      >
        <input type="hidden" value={token} {...register('token')} />
        <TextInput
          register={register}
          label="New password"
          type="password"
          name="password"
          error={errors.password}
          icon={<MdLock />}
        />
        <TextInput
          register={register}
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          options={{ required: true }}
          error={errors.confirmPassword}
          icon={<MdLock />}
        />

        <button type="submit" className="btn btn-primary w-full mt-6">
          Reset password
        </button>
      </form>
    </div>
  );

  return <div>ResetPasswordForm {token}</div>;
}
