'use client';

import { signIn } from 'next-auth/react';

export const CredentialsInput = ({
  label,
  name,
  type,
  icon,
  onChange,
  value,
}: {
  label: string;
  name: string;
  type: string;
  icon: JSX.Element;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) => (
  <div className="indicator w-full mt-3">
    <span className="indicator-item indicator-top indicator-center badge">
      {label}
    </span>
    <label className="input input-bordered input-sm flex items-center gap-2 w-full">
      {icon}
      <input
        type={type}
        placeholder={label}
        name={name}
        value={value}
        className="grow"
        autoComplete="off"
        onChange={onChange}
      />
    </label>
  </div>
);

export const CredentialsButton = ({
  credentials,
}: {
  credentials: { email: string; password: string };
}) => (
  <button
    type="button"
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    onClick={() => signIn('credentials', credentials)}
    className="btn btn-primary btn-sm mt-3 w-full"
  >
    Sign in
  </button>
);
