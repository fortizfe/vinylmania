import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: 'My library', to: '/app/library' },
  { label: 'My wishlist', to: '/app/wishlist' },
  { label: 'Profile', to: '/app/profile' },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-label="Menu"
      >
        <HamburgerIcon />
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Menu" position="end">
        <nav className="flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 font-medium text-gray-900 no-underline hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Modal>
    </>
  );
}
