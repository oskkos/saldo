'use client';

import Image from 'next/image';
import { MdEmail } from 'react-icons/md';
import { MdLock } from 'react-icons/md';
import { useState } from 'react';
import { ErrorMsg, errStringResolver } from './errorHandler';
import { CredentialsButton, CredentialsInput } from './credentialsComponents';
import { OAuthButton } from './oauthButton';

export default function Signin({ error }: { error: string | undefined }) {
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const errMsg = errStringResolver(error);

  return (
    <div className="w-full flex items-center justify-center">
      <div className="card card-bordered bg-base-100 w-96 shadow-xl m-6 mb-12">
        <div className="card-body items-center">
          <div className="card-title">
            <Image src="/img/saldo.png" alt="" width={64} height={64}></Image>
            <span className="text-2xl">saldo</span>
          </div>
          {errMsg && <ErrorMsg msg={errMsg} />}
          <div className="oauth-login flex items-center gap-2 mt-4">
            <OAuthButton name="Google" id="google" imgSrc="/img/google.svg" />
            <OAuthButton name="GitHub" id="github" imgSrc="/img/github.svg" />
          </div>

          <div className="divider divider-primary"></div>

          <div className="credentials-login flex flex-col items-center">
            <div className="text-xs mb-3">
              No Google or GitHub? Sign in with email and password.
            </div>
            <form>
              <CredentialsInput
                label="Email"
                name="email"
                type="text"
                icon={<MdEmail />}
                value={credentials.email}
                onChange={(e) => {
                  setCredentials({ ...credentials, email: e.target.value });
                }}
              />
              <CredentialsInput
                label="Password"
                name="password"
                type="password"
                icon={<MdLock />}
                value={credentials.password}
                onChange={(e) => {
                  setCredentials({ ...credentials, password: e.target.value });
                }}
              />
              <CredentialsButton credentials={credentials} />
            </form>
          </div>

          <div className="divider divider-primary"></div>

          <p className="text-sm font-light">
            New to saldo?{' '}
            <a href="/signup" className="font-medium hover:underline">
              Signup here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
