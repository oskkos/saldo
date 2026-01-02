'use client';

import Message from '@/components/message';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Card } from '../card';
import { SigninPageLink } from './signinPageLink';
import { ResetPasswordForm } from './resetPasswordForm';

export function Page2({ token }: { token: string }) {
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

  return (
    <Card
      message={msg}
      content={[
        <ResetPasswordForm
          key="reset-password-form"
          token={token}
          onSuccess={onSuccess}
          onError={onError}
        />,
        <SigninPageLink key="signin-page-link" />,
      ]}
    />
  );
}
