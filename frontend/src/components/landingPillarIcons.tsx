export function CatalogIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-6 w-6"
    >
      <circle cx="10" cy="10" r="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RatingIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 3l1.9 4.6 5 .4-3.8 3.3 1.2 4.9L10 13.8l-4.3 2.4 1.2-4.9-3.8-3.3 5-.4L10 3Z"
      />
    </svg>
  );
}

export function NewsIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-6 w-6"
    >
      <rect
        x="3"
        y="4"
        width="14"
        height="12"
        rx="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h8M6 11h8M6 14h5" />
    </svg>
  );
}
