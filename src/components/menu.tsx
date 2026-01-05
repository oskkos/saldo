'use client';
import Link from 'next/link';
import { NavBarItemArray } from './navItems';
import { usePathname } from 'next/navigation';

export default function Menu() {
  const currentPath = usePathname();

  return (
    <ul className="menu menu-horizontal hidden lg:flex">
      {NavBarItemArray.map((elem) => {
        const href = elem[0];
        const Icon = elem[1];
        const label = elem[2];
        return (
          <li key={href} className={currentPath === href ? 'border-b-2' : ''}>
            <Link href={href}>
              <Icon className="w-6 h-6" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
