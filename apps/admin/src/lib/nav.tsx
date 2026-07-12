import {
  LayoutDashboardIcon,
  ShieldCheckIcon,
  UsersIcon,
  BriefcaseIcon,
  StoreIcon,
  Settings2Icon,
} from 'lucide-react';
import type { Role } from './api/users';

// Admin console navigation, with per-item role gating. An item (or group) with
// no `roles` is visible to any staff member (ADMIN + SUPPORT); otherwise the
// user's role must be listed. SUPPORT is moderation-only, so user management,
// categories, audit log and settings are ADMIN-only — mirroring the backend
// RBAC in packages/auth/src/access.ts.
export type NavLink = {
  title: string;
  url: string;
  roles?: Role[];
};

export type NavGroup = {
  title: string;
  icon: React.ReactNode;
  roles?: Role[];
  items: NavLink[];
};

const ADMIN_ONLY: Role[] = ['ADMIN'];

export const navGroups: NavGroup[] = [
  {
    title: 'Dashboard',
    icon: <LayoutDashboardIcon />,
    items: [{ title: 'Overview', url: '/' }],
  },
  {
    title: 'Trust & Safety',
    icon: <ShieldCheckIcon />,
    items: [
      { title: 'Reports', url: '/reports' },
      { title: 'Verifications', url: '/verifications' },
      { title: 'Reviews', url: '/reviews', roles: ADMIN_ONLY },
    ],
  },
  {
    title: 'Users',
    icon: <UsersIcon />,
    roles: ADMIN_ONLY,
    items: [{ title: 'All users', url: '/users', roles: ADMIN_ONLY }],
  },
  {
    title: 'Jobs & Escrow',
    icon: <BriefcaseIcon />,
    items: [
      { title: 'Jobs', url: '/jobs' },
      { title: 'Escrow', url: '/escrow' },
    ],
  },
  {
    title: 'Marketplace',
    icon: <StoreIcon />,
    roles: ADMIN_ONLY,
    items: [{ title: 'Categories', url: '/categories', roles: ADMIN_ONLY }],
  },
  {
    title: 'System',
    icon: <Settings2Icon />,
    roles: ADMIN_ONLY,
    items: [
      { title: 'Audit log', url: '/audit-log', roles: ADMIN_ONLY },
      { title: 'Settings', url: '/settings', roles: ADMIN_ONLY },
    ],
  },
];

// Filters the nav tree down to what the given role may see, dropping groups
// that end up with no visible links.
export function navForRole(role: Role | undefined): NavGroup[] {
  const allowed = (roles?: Role[]) => !roles || (role && roles.includes(role));
  return navGroups
    .filter((group) => allowed(group.roles))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed(item.roles)),
    }))
    .filter((group) => group.items.length > 0);
}
