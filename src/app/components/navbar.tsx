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

function items(session: Session | null) {
  return session ? <NavbarItems drawerToggleId="saldo-navbar" /> : [];
}

async function getSaldoBadge(session: Session) {
  const user = await getUser(session.user?.email ?? '');
  const worklogs = await getWorklogs(user.id);
  const settings = await getSettings(user.id);
  if (!settings) {
    throw new Error('No settings!');
  }
  const saldo = calculateCurrentSaldo(settings, worklogs);
  return <div className="text-xl mr-4">{saldo.toBadge('badge-lg')}</div>;
}
export default async function Navbar({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

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
          <div className="px-2 mx-2 text-2xl">saldo</div>
          <div className="grow hidden lg:block">
            <ul className="menu menu-horizontal">{items(session)}</ul>
          </div>
          <div className="grow justify-end mr-4">
            {session ? getSaldoBadge(session) : null}
            <AuthActions onAfterSignIn={onAfterSignin} />
          </div>
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
