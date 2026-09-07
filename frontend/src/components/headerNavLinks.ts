export interface HeaderNavLink {
  key: 'library' | 'wishlist' | 'stats' | 'profile';
  label: string;
  to: string;
}

export const NAV_LINKS: HeaderNavLink[] = [
  { key: 'library', label: 'My library', to: '/app/library' },
  { key: 'wishlist', label: 'My wishlist', to: '/app/wishlist' },
  { key: 'stats', label: 'Collection stats', to: '/app/stats' },
  { key: 'profile', label: 'Profile', to: '/app/profile' },
];
