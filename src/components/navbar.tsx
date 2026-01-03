import 'server-only';

import AuthActions from '@/auth/authActions';
import { MdOutlineMenu } from 'react-icons/md';
import NavbarItems from './navBarItems';
import { Session } from 'next-auth';
import QuickAdd from './quickAdd';
import SaldoBadge from './saldoBadge';
import { Settings, Worklog } from '@/types';
import ThemeSwitcher from './themeSwitcher';

function items(showItems: boolean) {
  return showItems ? <NavbarItems drawerToggleId="saldo-navbar" /> : [];
}

export default function Navbar({
  settings,
  session,
  worklogs,
  children,
}: {
  settings: Settings | null;
  session: Session | null;
  worklogs: Worklog[];
  children: React.ReactNode;
}) {
  const iconCls = 'rounded-full h-6 w-6 sm:h-8 sm:w-8 mr-2';

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
          <div className="pr-2 sm:mr-2 lg:ml-4 text-xl">saldo</div>
          <div className="hidden lg:block">
            <ul className="menu menu-horizontal">
              {items(Boolean(settings && session))}
            </ul>
          </div>

          {settings && session ? (
            [
              <div key="saldoBadge" className="flex grow justify-center">
                <SaldoBadge settings={settings} worklogs={worklogs} />
              </div>,
              <QuickAdd
                key="quickAdd"
                defaults={{
                  fromDefault: settings.fromDefault,
                  toDefault: settings.toDefault,
                }}
              />,
              <AuthActions
                key="authActions"
                session={session}
                className={iconCls}
              />,
            ]
          ) : (
            <div className="grow" />
          )}
          <ThemeSwitcher className={iconCls} />
        </div>
        <div className="overflow-auto">{children}</div>
      </div>
      <div className="drawer-side z-10">
        <label htmlFor="saldo-navbar" className="drawer-overlay"></label>
        <ul className="menu p-4 w-80 h-full bg-base-200">
          {items(Boolean(settings && session))}
        </ul>
      </div>
    </div>
  );
}
