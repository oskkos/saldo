import { onAfterSignin } from '@/actions';
import AuthActions from '@/auth/authActions';
import AuthenticatedContent from '@/auth/authenticatedContent';
import Link from 'next/link';
import { MdHome, MdList, MdOutlineMenu, MdSettings } from 'react-icons/md';
import { getSession } from '../api/auth/[...nextauth]/route';

async function items() {
  const session = await getSession();

  return session
    ? [
        <>
          <li>
            <Link href="/">
              <MdHome className="w-6 h-6" />
              Home
            </Link>
          </li>
          <li>
            <Link href="/worklog-items">
              <MdList className="w-6 h-6" />
              Worklog items
            </Link>
          </li>
          <li>
            <Link href="/settings">
              <MdSettings className="w-6 h-6" />
              Settings
            </Link>
          </li>
        </>,
      ]
    : [];
}

export default function Navbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="drawer">
      <input id="my-drawer-3" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        {/* Navbar */}
        <div className="w-full navbar text-primary-content bg-primary p-0">
          <div className="flex-none lg:hidden">
            <label htmlFor="my-drawer-3" className="btn btn-square btn-ghost">
              <MdOutlineMenu className="w-6 h-6" />
            </label>
          </div>
          <div className="flex-1 px-2 mx-2 text-2xl">saldo</div>
          <div className="flex-none hidden lg:block">
            <ul className="menu menu-horizontal">{items()}</ul>
          </div>
          <div className="mr-4">
            <AuthActions onAfterSignIn={onAfterSignin} />
          </div>
        </div>
        <AuthenticatedContent>{children}</AuthenticatedContent>
      </div>
      <div className="drawer-side">
        <label htmlFor="my-drawer-3" className="drawer-overlay"></label>
        <ul className="menu p-4 w-80 h-full bg-base-200">{items()}</ul>
      </div>
    </div>
  );
}
