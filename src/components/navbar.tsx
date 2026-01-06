import 'server-only';

import Image from 'next/image';
import AuthActions from '@/auth/authActions';
import Menu from './menu';
import { Session } from 'next-auth';
import QuickAdd from './quickAdd';
import SaldoBadge from './saldoBadge';
import { Settings, Worklog } from '@/types';
import ThemeSwitcher from './themeSwitcher';
import Dock from './dock';
import Link from 'next/link';

export default async function Navbar({
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
    <>
      {/* Navbar */}
      <div className="w-full navbar text-primary-content bg-primary p-0">
        <Link href="/">
          <Image
            src="/img/saldo-with-text.png"
            alt="saldo"
            width={96}
            height={48}
            priority={true}
          ></Image>
        </Link>
        {settings && session ? (
          [
            <Menu key="menu" />,
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

      {/* Page content */}
      <div className="overflow-auto pb-16 lg:pb-0">{children}</div>

      {/* Dock */}
      {settings && session ? <Dock /> : null}
    </>
  );
}
