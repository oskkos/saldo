'use client';

import { useState } from 'react';
import { SigninPageLink } from './signinPageLink';
import { Card } from '../card';
import { SignupForm } from './signupForm';
import Message from '@/components/message';

export default function Signup() {
  const [msg, setMsg] = useState<JSX.Element | undefined>(undefined);
  const onSuccess = (successMsg: string | JSX.Element) => {
    setMsg(<Message type="success" title={successMsg} />);
  };
  const onError = (errorMsg: string | JSX.Element) => {
    setMsg(<Message type="error" title={errorMsg} />);
  };

  const content = [
    <SignupForm key="signup-form" onSuccess={onSuccess} onError={onError} />,
    <SigninPageLink key="signin-page-link" />,
  ];

  return <Card message={msg} content={content} />;
}
