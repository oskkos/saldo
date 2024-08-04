'use client';

import Image from 'next/image';
import { MdEmail } from 'react-icons/md';
import { MdLock } from 'react-icons/md';
import { ErrorMsg, errStringResolver } from './errorHandler';
import { OAuthButton } from './oauthButton';
import { useForm } from 'react-hook-form';
import { signIn } from 'next-auth/react';
import { TextInput } from '@/components/form/textInput';
import { SigninData, signinSchemaResolver } from '@/schemas/signinSchema';

export default function Signin({ error }: { error: string | undefined }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SigninData>({
    resolver: signinSchemaResolver,
  });

  const errMsg = errStringResolver(error);

  const onSubmit = async (credentials: SigninData) => {
    await signIn('credentials', { ...credentials });
  };
  return (
    <div className="w-full flex items-center justify-center">
      <div className="card card-bordered bg-base-100 w-96 shadow-xl m-6 mb-12">
        <div className="card-body items-center">
          <div className="card-title">
            <Image src="/img/saldo.png" alt="" width={64} height={64}></Image>
            <span className="text-2xl">saldo</span>
          </div>
          {errMsg && <ErrorMsg msg={errMsg} />}
          <div className="oauth-login flex items-center gap-2 mt-4">
            <OAuthButton name="Google" id="google" imgSrc="/img/google.svg" />
            <OAuthButton name="GitHub" id="github" imgSrc="/img/github.svg" />
          </div>

          <div className="divider divider-primary"></div>

          <div className="credentials-login flex flex-col items-center">
            <div className="text-xs mb-3">
              No Google or GitHub? Sign in with email and password.
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-misused-promises*/}
            <form onSubmit={handleSubmit(onSubmit)}>
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
            </form>
          </div>

          <div className="divider divider-primary"></div>

          <p className="text-sm font-light">
            New to saldo?{' '}
            <a href="/signup" className="font-medium hover:underline">
              Signup here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
