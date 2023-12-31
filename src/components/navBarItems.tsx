'use client';
import Link from 'next/link';
import {
  MdCalendarMonth,
  MdList,
  MdQueryStats,
  MdSettings,
  MdWorkOff,
} from 'react-icons/md';

export default function NavbarItems({
  drawerToggleId,
}: {
  drawerToggleId: string;
}) {
  return (
    [
      ['/', MdCalendarMonth, 'Calendar'],
      ['/worklog-items', MdList, 'All worklogs'],
      ['/absence', MdWorkOff, 'Absence'],
      ['/settings', MdSettings, 'Settings'],
      ['/statistics', MdQueryStats, 'Statistics'],
    ] as const
  ).map((li) => {
    const href = li[0];
    const Icon = li[1];
    const label = li[2];
    return (
      <li key={href}>
        <Link
          href={href}
          onClick={() => {
            // If drawer is visible close on click
            const toggle = document.getElementById(
              drawerToggleId,
            ) as HTMLInputElement | null;
            if (toggle?.checked) {
              toggle.click();
            }
          }}
        >
          <Icon className="w-6 h-6" />
          {label}
        </Link>
      </li>
    );
  });
}
