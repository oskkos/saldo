'use client';
import { useState } from 'react';
import { ForgotPasswordForm } from './forgotPasswordForm';
import Message from '@/components/message';
import { SignupPageLink } from './signupPageLink';
import { Card } from '../card';

export default function ForgotPassword() {
  const [msg, setMsg] = useState<JSX.Element | undefined>(undefined);
  const onSuccess = (
    successMsg: string | JSX.Element,
    successDescription?: string | JSX.Element,
  ) => {
    setMsg(
      <Message
        type="success"
        title={successMsg}
        description={successDescription}
      />,
    );
  };
  const onError = (errorMsg: string | JSX.Element) => {
    setMsg(<Message type="error" title={errorMsg} />);
  };

  const content = [
    <ForgotPasswordForm
      key="signup-form"
      onSuccess={onSuccess}
      onError={onError}
    />,
    <SignupPageLink key="signup-page-link" />,
  ];

  return <Card message={msg} content={content} />;
}
