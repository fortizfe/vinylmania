import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { NAV_LINKS, type HeaderNavLink } from './headerNavLinks';
import { iconButtonClassName } from './ui/Button';

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <circle cx="10" cy="6.5" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 17c1.2-3.5 4-5 6.5-5s5.3 1.5 6.5 5"
      />
    </svg>
  );
}

function WishlistIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 17S3 12.5 3 7.8A3.3 3.3 0 0 1 10 6a3.3 3.3 0 0 1 7 1.8C17 12.5 10 17 10 17Z"
      />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
    >
      <rect
        x="3"
        y="4"
        width="14"
        height="3"
        rx="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3"
        y="8.5"
        width="14"
        height="3"
        rx="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3"
        y="13"
        width="14"
        height="3"
        rx="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS: Record<HeaderNavLink['key'], () => ReactElement> = {
  library: LibraryIcon,
  wishlist: WishlistIcon,
  profile: ProfileIcon,
};

export function HeaderNavIcons() {
  return (
    <div className="hidden items-center gap-2 md:flex">
      {NAV_LINKS.map((link) => {
        const Icon = ICONS[link.key];
        return (
          <Link
            key={link.to}
            to={link.to}
            aria-label={link.label}
            className={iconButtonClassName()}
          >
            <Icon />
          </Link>
        );
      })}
    </div>
  );
}
