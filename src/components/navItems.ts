import {
  MdCalendarMonth,
  MdList,
  MdQueryStats,
  MdSettings,
  MdWorkOff,
} from 'react-icons/md';

export const NavBarItemArray = [
  ['/', MdCalendarMonth, 'Calendar'],
  ['/worklog-items', MdList, 'All worklogs'],
  ['/absence', MdWorkOff, 'Absence'],
  ['/settings', MdSettings, 'Settings'],
  ['/statistics', MdQueryStats, 'Statistics'],
] as const;
