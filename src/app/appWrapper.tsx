'use client';

import { App, Navbar } from 'konsta/react';

export default function AppWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <App>
      <Navbar title="Saldo" />
      {children}
    </App>
  );
}
