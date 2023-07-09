import { onAfterSignin } from '@/actions';
import AuthActions from '@/auth/authActions';
import AuthenticatedContent from '@/auth/authenticatedContent';
import { MdOutlineMenu } from 'react-icons/md';
import { getSession } from '../api/auth/[...nextauth]/route';
import NavbarItems from './navBarItems';

async function items() {
  const session = await getSession();

  return session ? <NavbarItems drawerToggleId="saldo-navbar" /> : [];
}

export default function Navbar({ children }: { children: React.ReactNode }) {
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
            <ul className="menu menu-horizontal">{items()}</ul>
          </div>
          <div className="grow justify-end mr-4">
            <AuthActions onAfterSignIn={onAfterSignin} />
          </div>
        </div>
        <AuthenticatedContent>{children}</AuthenticatedContent>
      </div>
      <div className="drawer-side z-10">
        <label htmlFor="saldo-navbar" className="drawer-overlay"></label>
        <ul className="menu p-4 w-80 h-full bg-base-200">{items()}</ul>
      </div>
    </div>
  );
}
