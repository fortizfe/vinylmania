import { type FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { buildSearchPath, useSearchQueryParams } from '../hooks/useSearchQueryParams';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const SEARCH_RESULTS_PATH = '/app/search';

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <circle cx="9" cy="9" r="6" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 17l-4-4" />
    </svg>
  );
}

export function HeaderSearchBox() {
  const location = useLocation();
  const navigate = useNavigate();
  const onResultsPage = location.pathname === SEARCH_RESULTS_PATH;
  const { query: urlQuery } = useSearchQueryParams();

  const [value, setValue] = useState(() => (onResultsPage ? urlQuery : ''));

  useEffect(() => {
    setValue(onResultsPage ? urlQuery : '');
  }, [onResultsPage, urlQuery]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    navigate(buildSearchPath(trimmed, 1), { replace: onResultsPage });
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex w-40 gap-2 sm:w-64 md:w-80">
      <div className="flex-1">
        <Input
          id="header-search"
          label="Search Discogs"
          hideLabel
          type="search"
          placeholder="Search Discogs…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <Button type="submit" size="icon" variant="secondary" aria-label="Search">
        <SearchIcon />
      </Button>
    </form>
  );
}
