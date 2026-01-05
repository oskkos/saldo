'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { NavBarItemArray } from './navItems';

export default function Dock() {
  const currentPath = usePathname();

  return (
    <div className="dock dock-md pb-0! lg:hidden">
      {NavBarItemArray.map((elem, i) => {
        const href = elem[0];
        const Icon = elem[1];
        const label = elem[2];

        return (
          <button className={currentPath === href ? 'dock-active' : ''} key={i}>
            <Link href={href} className="flex flex-col items-center">
              <Icon className="w-5 h-5" />
              <span className="dock-label">{label}</span>
            </Link>
          </button>
        );
      })}
    </div>
  );
}
