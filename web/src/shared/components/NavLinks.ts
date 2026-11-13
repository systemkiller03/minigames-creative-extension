export type NavItem = {
  label: string;
  to: '/' | '/library';
  /** Out-of-scope pages: shown in the UI, but they send the user to the home page. */
  redirectsHome?: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Library', to: '/library' },
  { label: 'Tournaments', to: '/', redirectsHome: true },
  { label: 'Community', to: '/', redirectsHome: true },
];
