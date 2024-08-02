/* eslint-disable @typescript-eslint/no-misused-promises */
'use client';

import Image from 'next/image';
import { TextInput } from './textInput';
import {
  SignupData,
  SignupDataFields,
  signupSchemaResolver,
} from '@/schemas/signupSchema';
import { useForm } from 'react-hook-form';
import { onAfterSignup } from '@/actions';

export default function Signup() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SignupData>({
    resolver: signupSchemaResolver,
  });

  return (
    <div className="w-full flex items-center justify-center">
      <div className="card card-bordered bg-base-100 w-96 shadow-xl m-6 mb-12">
        <form
          onSubmit={handleSubmit(async (data) => {
            const ret = await onAfterSignup(data);
            if (ret.status === 'success') {
              alert('tada');
            }
            if (ret.status === 'error') {
              const errors = ret.errors ?? {};
              Object.keys(ret.errors ?? {}).forEach((field) => {
                if (!SignupDataFields[field]) {
                  return;
                }
                setError(SignupDataFields[field], {
                  type: 'server',
                  message: errors[field],
                });
              });
            }
          })}
        >
          <div className="card-body items-center">
            <div className="card-title">
              <Image src="/img/saldo.png" alt="" width={70} height={70}></Image>
              <span className="text-2xl">saldo</span>
            </div>
            <div>
              <div className="p-6 space-y-4">
                <h1 className="text-xl font-bold">Create an account</h1>
                <TextInput
                  register={register}
                  label="Name"
                  type="text"
                  name="name"
                  options={{ required: true }}
                  error={errors.name}
                />
                <TextInput
                  register={register}
                  label="Email"
                  type="email"
                  name="email"
                  error={errors.email}
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
                />
                <TextInput
                  register={register}
                  label="Confirm password"
                  type="password"
                  name="confirmPassword"
                  options={{ required: true }}
                  error={errors.confirmPassword}
                />
              </div>
            </div>
            <div className="card-actions">
              <button type="submit" className="btn btn-primary w-full">
                Create an account
              </button>
            </div>
            <div className="mt-6">
              <p className="text-sm font-light">
                Already have an account?{' '}
                <a
                  href="/api/auth/signin"
                  className="font-medium hover:underline"
                >
                  Login here
                </a>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
