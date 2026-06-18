'use client';

import * as React from 'react';

import { NavMain } from '@repo/ui/components/nav-main';
import { NavUser } from '@repo/ui/components/nav-user';
import { TeamSwitcher } from '@repo/ui/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@repo/ui/components/ui/sidebar';
import {
  HammerIcon,
  LayoutDashboardIcon,
  BriefcaseIcon,
  StoreIcon,
  ShieldCheckIcon,
  UsersIcon,
  Settings2Icon,
} from 'lucide-react';

// Crafty Bass marketplace admin navigation.
const data = {
  user: {
    name: 'Admin',
    email: 'admin@craftybass.com',
    avatar: '/avatars/admin.jpg',
  },
  teams: [
    {
      name: 'Crafty Bass',
      logo: <HammerIcon />,
      plan: 'Admin',
    },
  ],
  navMain: [
    {
      title: 'Dashboard',
      url: '/',
      icon: <LayoutDashboardIcon />,
      isActive: true,
      items: [
        { title: 'Overview', url: '/' },
        { title: 'Review queue', url: '/queue' },
      ],
    },
    {
      title: 'Jobs',
      url: '#',
      icon: <BriefcaseIcon />,
      items: [
        { title: 'All jobs', url: '#' },
        { title: 'Quotes', url: '#' },
        { title: 'Recommendations', url: '#' },
      ],
    },
    {
      title: 'Marketplace',
      url: '#',
      icon: <StoreIcon />,
      items: [
        { title: 'Categories', url: '#' },
        { title: 'Skills', url: '#' },
      ],
    },
    {
      title: 'Trust & Safety',
      url: '#',
      icon: <ShieldCheckIcon />,
      items: [
        { title: 'Reports', url: '#' },
        { title: 'Verifications', url: '#' },
        { title: 'Reviews', url: '#' },
      ],
    },
    {
      title: 'Users',
      url: '#',
      icon: <UsersIcon />,
      items: [
        { title: 'Homeowners', url: '#' },
        { title: 'Tradespeople', url: '#' },
      ],
    },
    {
      title: 'Settings',
      url: '#',
      icon: <Settings2Icon />,
      items: [
        { title: 'General', url: '#' },
        { title: 'Legal & consent', url: '#' },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
