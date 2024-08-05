'use client';

import { TextInput } from '@/components/form/textInput';
import {
  ForgotPasswordData,
  forgotPasswordSchemaResolver,
} from '@/schemas/forgotPasswordSchema';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { MdMail } from 'react-icons/md';

/*
<mail logo> Email Sent
We will send you an email with instructions to reset your password if the email is valid.

<a>Back to Sign in</a>

*/

export function Form() {
  const msg = '';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    resolver: forgotPasswordSchemaResolver,
  });

  const onSubmit = (data: ForgotPasswordData) => {
    console.log(data);
  };

  return (
    <div className="w-full flex items-center justify-center">
      <div className="card card-bordered bg-base-100 w-96 shadow-xl m-6 mb-12">
        <div className="card-body items-center">
          <div className="card-title">
            <Image src="/img/saldo.png" alt="" width={64} height={64}></Image>
            <span className="text-2xl">saldo</span>
          </div>
          {msg}
          <div className="flex flex-col items-center">
            <div className="my-4 text-sm w-64">
              Enter the email address associated with your account and
              we&apos;ll send you a link to reset your password.
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-misused-promises*/}
            <form onSubmit={handleSubmit(onSubmit)}>
              <TextInput
                register={register}
                label="Email"
                type="email"
                name="email"
                error={errors.email}
                icon={<MdMail />}
              />
              <button type="submit" className="btn btn-primary w-full mt-6">
                Continue
              </button>
            </form>
          </div>

          <div className="divider divider-primary"></div>

          <p className="text-sm font-light">
            Don&apos;t have an account?{' '}
            <a href="/signup" className="font-medium hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
