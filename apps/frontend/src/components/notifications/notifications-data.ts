// TODO(backend): there is no Notification model/endpoint yet (see plan Gap #3).
// This presentational seed lets the bell + center render real-looking data;
// swap `useNotifications` for a TanStack Query hook against the API once it
// exists. Item copy stays in English here (dynamic content); the surrounding
// chrome is localised via the `notifications` dictionary block.

export type NotificationTint = 'green' | 'amber' | 'neutral';
export type NotificationCategory = 'escrow' | 'message' | 'job' | 'account';

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  group: string;
  tint: NotificationTint;
  icon: string;
  unread: boolean;
  time: string;
  title: string;
  body?: string;
  href?: string;
  action?: string;
};

export const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    category: 'escrow',
    group: 'Today',
    tint: 'green',
    icon: 'hand-coins',
    unread: true,
    time: '20m ago',
    title: 'Saman Rajapaksa requested a materials deposit',
    body: 'LKR 5,760 for “Replace bathroom shower mixer”. It goes into escrow — you pay Crafty Bass, not the tradesman.',
    href: 'jobs',
    action: 'Review & fund',
  },
  {
    id: 'n2',
    category: 'message',
    group: 'Today',
    tint: 'neutral',
    icon: 'message-circle',
    unread: true,
    time: '2:14 PM',
    title: 'Tariq Hameed sent you a message',
    body: '“Sounds good — I’ll bring the cartridge and a spare seal kit.”',
    href: 'messages',
  },
  {
    id: 'n3',
    category: 'job',
    group: 'Today',
    tint: 'neutral',
    icon: 'receipt-text',
    unread: false,
    time: '11:02 AM',
    title: 'New quote on your job',
    body: 'Nuwan Perera quoted LKR 14,000 for the shower mixer replacement.',
    href: 'jobs',
  },
  {
    id: 'n4',
    category: 'escrow',
    group: 'This week',
    tint: 'green',
    icon: 'lock',
    unread: false,
    time: 'Yesterday',
    title: 'Deposit secured in escrow',
    body: 'Your LKR 5,760 is held safely by Crafty Bass and stays refundable until work begins.',
  },
  {
    id: 'n5',
    category: 'escrow',
    group: 'This week',
    tint: 'green',
    icon: 'wrench',
    unread: true,
    time: 'Yesterday',
    title: 'Saman marked your job complete',
    body: 'Check the work, then release the balance from escrow and leave a review.',
    href: 'jobs',
    action: 'Approve & review',
  },
  {
    id: 'n6',
    category: 'job',
    group: 'This week',
    tint: 'amber',
    icon: 'star',
    unread: false,
    time: 'Wed',
    title: 'Dilani Fernando left you a 5★ review',
    body: '“Thanks for the quick work, much appreciated!”',
  },
  {
    id: 'n7',
    category: 'account',
    group: 'Earlier',
    tint: 'neutral',
    icon: 'badge-check',
    unread: false,
    time: '18 Jun',
    title: 'Your verification is under review',
    body: 'We’re checking your NIC and trade licence. Quoting unlocks once you’re approved.',
    href: 'account/get-verified',
    action: 'View status',
  },
  {
    id: 'n8',
    category: 'escrow',
    group: 'Earlier',
    tint: 'green',
    icon: 'circle-check-big',
    unread: false,
    time: '8 Jun',
    title: 'Balance released',
    body: 'LKR 9,800 paid to your tradesman for “Install ceiling fans ×3”. The job is now closed.',
  },
];
