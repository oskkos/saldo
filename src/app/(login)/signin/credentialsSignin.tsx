'use client';

import { MdEmail } from 'react-icons/md';
import { MdLock } from 'react-icons/md';
import { TextInput } from '@/components/form/textInput';
import { useForm } from 'react-hook-form';
import { SigninData, signinSchemaResolver } from '@/schemas/signinSchema';
import { signIn } from 'next-auth/react';

const onSubmit = async (credentials: SigninData) => {
  await signIn('credentials', { ...credentials });
};

export function CredentialsSignin() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SigninData>({
    resolver: signinSchemaResolver,
  });

  return (
    <div className="credentials-login flex flex-col items-center">
      <div className="text-xs mb-3">
        No Google or GitHub? Sign in with email and password.
      </div>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSubmit={handleSubmit(onSubmit)}
        className="flex items-center flex-col"
      >
        <TextInput
          label="Email"
          name="email"
          type="text"
          icon={<MdEmail />}
          register={register}
          options={{ required: true }}
          error={errors.email}
        />
        <TextInput
          label="Password"
          name="password"
          type="password"
          icon={<MdLock />}
          register={register}
          options={{ required: true }}
          error={errors.password}
        />
        <button type="submit" className="btn btn-primary mt-3 w-full">
          Sign in
        </button>
        <a
          href="/forgot-password"
          className="text-sm mt-2 hover:underline font-medium"
        >
          Forgot password?
        </a>
      </form>
    </div>
  );
}
