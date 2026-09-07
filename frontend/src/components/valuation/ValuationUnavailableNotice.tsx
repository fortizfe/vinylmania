import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ValuationUnavailableNoticeProps {
  variant: 'seller_settings' | 'unavailable';
  /** Re-drive the valuation loop (shown for the transient-outage variant). */
  onRetry?: () => void;
}

const COPY: Record<
  ValuationUnavailableNoticeProps['variant'],
  { heading: string; body: string }
> = {
  seller_settings: {
    heading: 'Estimated value needs your Discogs seller settings',
    body: "Discogs only provides price estimates once you've completed your seller settings on discogs.com. Your collection statistics above are unaffected.",
  },
  unavailable: {
    heading: "We couldn't estimate your collection's value right now",
    body: 'Discogs did not return price data this time. Your collection statistics above are unaffected — wait a moment, then try the valuation again.',
  },
};

/**
 * A non-blocking notice for Block 2 when the valuation cannot run (missing
 * seller settings, HTTP 422) or hit a transient outage. Block 1 stays fully
 * usable (FR-012, data-model §6). The message is text, not a colour state.
 */
export function ValuationUnavailableNotice({
  variant,
  onRetry,
}: ValuationUnavailableNoticeProps) {
  const copy = COPY[variant];

  return (
    <Card className="flex flex-col gap-2">
      <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">
        {copy.heading}
      </h3>
      <p className="text-sm text-stone-600 dark:text-stone-300">{copy.body}</p>
      {variant === 'unavailable' && onRetry && (
        <div className="pt-1">
          <Button variant="secondary" onClick={onRetry}>
            Try the valuation again
          </Button>
        </div>
      )}
    </Card>
  );
}
