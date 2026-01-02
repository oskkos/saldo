'use client';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ForgotPasswordForm } from './forgotPasswordForm';
import Message from '@/components/message';
import { SignupPageLink } from './signupPageLink';
import { Card } from '../card';

export default function ForgotPassword() {
  const [msg, setMsg] = useState<ReactElement | undefined>(undefined);
  const onSuccess = (successMsg: ReactNode, successDescription?: ReactNode) => {
    setMsg(
      <Message
        type="success"
        title={successMsg}
        description={successDescription}
      />,
    );
  };
  const onError = (errorMsg: ReactNode) => {
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
