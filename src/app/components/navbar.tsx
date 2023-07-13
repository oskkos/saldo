import { onAfterSignin } from '@/actions';
import AuthActions from '@/auth/authActions';
import AuthenticatedContent from '@/auth/authenticatedContent';
import { MdOutlineMenu } from 'react-icons/md';
import { getSession } from '../api/auth/[...nextauth]/route';
import NavbarItems from './navBarItems';
import { Session } from 'next-auth';
import { getSettings, getUser } from '@/repository/userRepository';
import { getWorklogs } from '@/repository/worklogRepository';
import { calculateCurrentSaldo } from '@/services';
import QuickAdd from './quickAdd';

function items(session: Session | null) {
  return session ? <NavbarItems drawerToggleId="saldo-navbar" /> : [];
}

async function getSaldoBadge(userId: number) {
  const worklogs = await getWorklogs(userId);
  const settings = await getSettings(userId);
  if (!settings) {
    throw new Error('No settings!');
  }
  const saldo = calculateCurrentSaldo(settings, worklogs);
  return saldo.toBadge('badge-lg');
}
export default async function Navbar({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const user = session ? await getUser(session.user?.email ?? '') : null;

  return (
    <div className="drawer">
      <input id="saldo-navbar" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col max-h-screen">
        {/* Navbar */}
        <div className="w-full navbar text-primary-content bg-primary p-0">
          <div className="flex-none md:hidden">
            <label htmlFor="saldo-navbar" className="btn btn-square btn-ghost">
              <MdOutlineMenu className="w-6 h-6" />
            </label>
          </div>
          <div className="pr-2 mr-2 text-xl">saldo</div>
          <div className="hidden md:block">
            <ul className="menu menu-horizontal">{items(session)}</ul>
          </div>

          {user
            ? [
                <div key="saldoBadge" className="grow justify-center mr-2">
                  {getSaldoBadge(user.id)}
                </div>,
                <div key="quickAddWorklog" className="justify-end mr-2">
                  <QuickAdd userId={user.id} />
                </div>,
              ]
            : null}
          <AuthActions onAfterSignIn={onAfterSignin} />
        </div>
        <AuthenticatedContent>{children}</AuthenticatedContent>
      </div>
      <div className="drawer-side z-10">
        <label htmlFor="saldo-navbar" className="drawer-overlay"></label>
        <ul className="menu p-4 w-80 h-full bg-base-200">{items(session)}</ul>
      </div>
    </div>
  );
}
