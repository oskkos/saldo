'use client';

import Image from 'next/image';
import { TextInput } from '@/components/form/textInput';
import {
  SignupData,
  SignupDataFields,
  signupSchemaResolver,
} from '@/schemas/signupSchema';
import { useForm, UseFormSetError } from 'react-hook-form';
import { onAfterSignup } from '@/actions';
import {
  MdCheckCircleOutline,
  MdError,
  MdLock,
  MdMail,
  MdPerson,
} from 'react-icons/md';
import { useState } from 'react';

const Msg = ({
  type,
  icon,
  msg,
}: {
  type: 'success' | 'error';
  icon: JSX.Element;
  msg: string | JSX.Element;
}) => {
  return (
    <div role="alert" className={`alert alert-${type} mt-3`}>
      {icon}
      <div className="text-xs">{msg}</div>
    </div>
  );
};
const successMsg = (
  <>
    <span>User added succesfully!</span>{' '}
    <a href="/signin" className="font-medium hover:underline">
      Login here
    </a>
  </>
);
const handleFieldErrors = (
  errors: { [k: string]: string },
  setError: UseFormSetError<SignupData>,
) => {
  Object.keys(errors).forEach((field) => {
    if (!SignupDataFields[field]) {
      return;
    }
    setError(SignupDataFields[field], {
      type: 'server',
      message: errors[field],
    });
  });
};
export default function Signup() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SignupData>({
    resolver: signupSchemaResolver,
  });

  const [msg, setMsg] = useState<JSX.Element | null>(null);

  const onSubmit = async (data: SignupData) => {
    try {
      const ret = await onAfterSignup(data);
      if (ret.status === 'success') {
        setMsg(
          <Msg
            type="success"
            icon={<MdCheckCircleOutline />}
            msg={successMsg}
          />,
        );
      }
      if (ret.status === 'error') {
        handleFieldErrors(ret.errors ?? {}, setError);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'An error occurred.';
      setMsg(<Msg type="error" icon={<MdError />} msg={err} />);
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
            <div className="text-lg font-bold mt-4">Signup</div>
            {/* eslint-disable-next-line @typescript-eslint/no-misused-promises*/}
            <form onSubmit={handleSubmit(onSubmit)}>
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

          <div className="divider divider-primary"></div>

          <p className="text-sm font-light">
            Already have an account?{' '}
            <a href="/signin" className="font-medium hover:underline">
              Login here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
