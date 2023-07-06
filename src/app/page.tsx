'use client';
import { App, Navbar, Fab } from 'konsta/react';
import { MdAdd as PlusIcon } from 'react-icons/md';

export default function Home() {
  return (
    <Fab
      className="fixed right-4-safe bottom-4-safe z-20"
      icon={<PlusIcon />}
    />
  );
}
