'use client';

import { onForgotPassword } from '@/actions';
import { TextInput } from '@/components/form/textInput';
import Message from '@/components/message';
import {
  ForgotPasswordData,
  forgotPasswordSchemaResolver,
} from '@/schemas/forgotPasswordSchema';
import Image from 'next/image';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { MdMail } from 'react-icons/md';

const successTitle = <h3 className="font-bold">Email sent!</h3>;
const successDescription = (
  <span className="text-left">
    We will send you an email with instructions to reset your password if the
    email is valid.
  </span>
);

export function Form() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    resolver: forgotPasswordSchemaResolver,
  });

  const [msg, setMsg] = useState<JSX.Element | null>(null);

  const onSubmit = async (data: ForgotPasswordData) => {
    try {
      const ret = await onForgotPassword(data);
      if (ret.status === 'success') {
        setMsg(
          <Message
            type="success"
            title={successTitle}
            description={successDescription}
            icon={<MdMail />}
          />,
        );
      }
      if (ret.status === 'error') {
        // todo: handleFieldErrors(ret.errors ?? {}, setError);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'An error occurred.';
      setMsg(<Message type="error" title={err} />);
    }
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
