'use client';

import type { ReactNode } from 'react';
import { onAfterSignup } from '@/actions';
import { TextInput } from '@/components/form/textInput';
import {
  SignupData,
  SignupDataFields,
  signupSchemaResolver,
} from '@/schemas/signupSchema';
import { useForm, UseFormSetError } from 'react-hook-form';
import { MdLock, MdMail, MdPerson } from 'react-icons/md';
import { handleFormFieldErrors } from '../formFieldErrorHandler';

const successMsg = (
  <>
    <span>User added succesfully!</span>{' '}
    <a href="/signin" className="font-medium hover:underline">
      Login here
    </a>
  </>
);

const onSubmit = async (
  data: SignupData,
  onSuccess: (msg: ReactNode) => void,
  onError: (msg: ReactNode) => void,
  setError: UseFormSetError<SignupData>,
) => {
  try {
    const ret = await onAfterSignup(data);
    if (ret.status === 'success') {
      onSuccess(successMsg);
    }
    if (ret.status === 'error') {
      handleFormFieldErrors(ret.errors ?? {}, setError, SignupDataFields);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'An error occurred.';
    onError(err);
  }
};

export function SignupForm({
  onSuccess,
  onError,
}: {
  onSuccess: (msg: ReactNode) => void;
  onError: (msg: ReactNode) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SignupData>({
    resolver: signupSchemaResolver as any,
  });

  return (
    <div className="flex flex-col items-center">
      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises*/}
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSubmit={handleSubmit((data) =>
          onSubmit(data, onSuccess, onError, setError),
        )}
      >
        <TextInput
          register={register}
          label="Name"
          type="text"
          name="name"
          options={{ required: true }}
          error={errors.name}
          icon={<MdPerson />}
        />
        <TextInput
          register={register}
          label="Email"
          type="email"
          name="email"
          error={errors.email}
          icon={<MdMail />}
        />
        <TextInput
          register={register}
          label="Password"
          type="password"
          name="password"
          options={{
            required: true,
            minLength: { message: 'min len 8', value: 8 },
          }}
          error={errors.password}
          icon={<MdLock />}
        />
        <TextInput
          register={register}
          label="Confirm password"
          type="password"
          name="confirmPassword"
          options={{ required: true }}
          error={errors.confirmPassword}
          icon={<MdLock />}
        />

        <button type="submit" className="btn btn-primary w-full mt-6">
          Create an account
        </button>
      </form>
    </div>
  );
}
