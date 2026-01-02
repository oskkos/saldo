'use client';

import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { SigninPageLink } from './signinPageLink';
import { Card } from '../card';
import { SignupForm } from './signupForm';
import Message from '@/components/message';

export default function Signup() {
  const [msg, setMsg] = useState<ReactElement | undefined>(undefined);
  const onSuccess = (successMsg: ReactNode) => {
    setMsg(<Message type="success" title={successMsg} />);
  };
  const onError = (errorMsg: ReactNode) => {
    setMsg(<Message type="error" title={errorMsg} />);
  };

  const content = [
    <SignupForm key="signup-form" onSuccess={onSuccess} onError={onError} />,
    <SigninPageLink key="signin-page-link" />,
  ];

  return <Card message={msg} content={content} />;
}
