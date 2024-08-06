'use client';

import { onForgotPassword } from '@/actions';
import { TextInput } from '@/components/form/textInput';
import {
  ForgotPasswordData,
  ForgotPasswordDataFields,
  forgotPasswordSchemaResolver,
} from '@/schemas/forgotPasswordSchema';
import { useForm, UseFormSetError } from 'react-hook-form';
import { MdMail } from 'react-icons/md';
import { handleFormFieldErrors } from '../formFieldErrorHandler';

const successTitle = <h3 className="font-bold">Email sent!</h3>;
const successDescription = (
  <span className="text-left">
    We will send you an email with instructions to reset your password if the
    email is valid.
  </span>
);

const onSubmit = async (
  data: ForgotPasswordData,
  onSuccess: (
    msg: string | JSX.Element,
    description?: string | JSX.Element,
  ) => void,
  onError: (msg: string | JSX.Element) => void,
  setError: UseFormSetError<ForgotPasswordData>,
) => {
  try {
    const ret = await onForgotPassword(data);
    if (ret.status === 'success') {
      onSuccess(successTitle, successDescription);
    }
    if (ret.status === 'error') {
      handleFormFieldErrors(
        ret.errors ?? {},
        setError,
        ForgotPasswordDataFields,
      );
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'An error occurred.';
    onError(err);
  }
};

export function ForgotPasswordForm({
  onSuccess,
  onError,
}: {
  onSuccess: (
    msg: string | JSX.Element,
    description?: string | JSX.Element,
  ) => void;
  onError: (msg: string | JSX.Element) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<ForgotPasswordData>({
    resolver: forgotPasswordSchemaResolver,
  });

  return (
    <div className="flex flex-col items-center">
      <div className="my-4 text-sm w-64">
        Enter the email address associated with your account and we&apos;ll send
        you a link to reset your password.
      </div>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSubmit={handleSubmit((data) => {
          void onSubmit(data, onSuccess, onError, setError);
        })}
      >
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
  );
}
