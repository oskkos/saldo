import 'server-only';

import AuthActions from '@/auth/authActions';
import AuthenticatedContent from '@/auth/authenticatedContent';
import { MdOutlineMenu } from 'react-icons/md';
import NavbarItems from './navBarItems';
import { Session } from 'next-auth';
import QuickAdd from './quickAdd';
import SaldoBadge from './saldoBadge';
import { Settings, User, Worklog } from '@prisma/client';

function items(session: Session | null) {
  return session ? <NavbarItems drawerToggleId="saldo-navbar" /> : [];
}

export default function Navbar({
  user,
  settings,
  session,
  worklogs,
  children,
}: {
  user: User | null;
  settings: Settings | null;
  session: Session | null;
  worklogs: Worklog[];
  children: React.ReactNode;
}) {
  return (
    <div className="drawer">
      <input id="saldo-navbar" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col max-h-screen">
        {/* Navbar */}
        <div className="w-full navbar text-primary-content bg-primary p-0">
          <div className="flex-none lg:hidden">
            <label htmlFor="saldo-navbar" className="btn btn-square btn-ghost">
              <MdOutlineMenu className="w-6 h-6" />
            </label>
          </div>
          <div className="pr-2 mr-2 sm:ml-4 text-xl">saldo</div>
          <div className="hidden lg:block">
            <ul className="menu menu-horizontal">{items(session)}</ul>
          </div>

          {user ? (
            [
              <div key="saldoBadge" className="grow justify-center mr-2">
                <SaldoBadge settings={settings} worklogs={worklogs} />
              </div>,
              <div key="quickAddWorklog" className="justify-end mr-2">
                <QuickAdd userId={user.id} />
              </div>,
            ]
          ) : (
            <div className="grow" />
          )}
          <AuthActions />
        </div>
        <AuthenticatedContent user={user} settings={settings}>
          {children}
        </AuthenticatedContent>
      </div>
      <div className="drawer-side z-10">
        <label htmlFor="saldo-navbar" className="drawer-overlay"></label>
        <ul className="menu p-4 w-80 h-full bg-base-200">{items(session)}</ul>
      </div>
    </div>
  );
}
