import { useId, useState } from 'react';
import clsx from 'clsx';

import { m, spring, usePrefersReducedMotion } from '../../motion';
import type { GrowthSeries } from '../../services/collectionStatsApi';
import { Card } from '../ui/Card';
import { focusRing } from '../ui/focusRing';
import { pressable } from '../ui/press';

interface CollectionGrowthChartProps {
  growth: GrowthSeries;
}

type SeriesMode = 'added' | 'cumulative';

const SERIES_OPTIONS: { mode: SeriesMode; label: string }[] = [
  { mode: 'added', label: 'Per period' },
  { mode: 'cumulative', label: 'Cumulative' },
];

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `YYYY-MM` → `Mon YYYY` with a fixed table (locale-independent). */
function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const label = MONTHS[Number(month) - 1];
  return label ? `${label} ${year}` : period;
}

const VIEW_W = 640;
const VIEW_H = 220;
const PAD = { top: 16, right: 14, bottom: 28, left: 14 };
const PLOT_W = VIEW_W - PAD.left - PAD.right;
const PLOT_H = VIEW_H - PAD.top - PAD.bottom;
const BASELINE_Y = PAD.top + PLOT_H;

/**
 * Bespoke inline-SVG growth chart (no charting dependency — research.md
 * decision 7). Bars are per-period additions; the line is the cumulative
 * collection size. Both series are always available as a visually-hidden data
 * table and summarised in the SVG's `aria-label`, so nothing is conveyed by
 * colour or shape alone (Principle X). Bar-grow / line-draw motion uses the
 * shared spring token and is dropped entirely under `prefers-reduced-motion`
 * (Principle XI, apple-design §14).
 */
export function CollectionGrowthChart({ growth }: CollectionGrowthChartProps) {
  const headingId = useId();
  const reduceMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<SeriesMode>('added');

  const points = growth.points;
  const hasData = points.length > 0;

  const totalAdded = points.reduce((sum, point) => sum + point.added, 0);
  const finalCumulative = hasData ? points[points.length - 1].cumulative : 0;
  const summary = hasData
    ? `Collection growth by month: ${totalAdded} ${
        totalAdded === 1 ? 'record' : 'records'
      } added between ${formatPeriod(points[0].period)} and ${formatPeriod(
        points[points.length - 1].period,
      )}, reaching a cumulative total of ${finalCumulative}.`
    : 'Collection growth by month: no records added yet.';

  const addedMax = points.reduce((max, point) => Math.max(max, point.added), 0);
  const cumulativeMax = Math.max(1, finalCumulative);
  const slot = hasData ? PLOT_W / points.length : 0;
  const barWidth = slot * 0.62;
  const stepX = points.length > 1 ? PLOT_W / (points.length - 1) : 0;

  const lineCoords = points.map((point, index) => {
    const x = PAD.left + (points.length > 1 ? index * stepX : PLOT_W / 2);
    const y = BASELINE_Y - (point.cumulative / cumulativeMax) * PLOT_H;
    return [x, y] as const;
  });
  const linePath = lineCoords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  const areaPath = hasData
    ? `${linePath} L${lineCoords[lineCoords.length - 1][0].toFixed(1)} ${BASELINE_Y} ` +
      `L${lineCoords[0][0].toFixed(1)} ${BASELINE_Y} Z`
    : '';

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          id={headingId}
          className="text-base font-semibold text-stone-900 dark:text-stone-100"
        >
          Growth over time
        </h3>

        <div
          role="group"
          aria-label="Growth chart series"
          className="inline-flex gap-1 rounded-xl border border-stone-500 p-1 dark:border-border-dark"
        >
          {SERIES_OPTIONS.map((option) => {
            const active = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(option.mode)}
                className={clsx(
                  'min-h-11 rounded-lg px-3 text-sm font-medium',
                  focusRing,
                  pressable,
                  active
                    ? 'bg-primary text-white'
                    : 'text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No growth data yet — your collection has no dated additions.
        </p>
      ) : (
        <>
          <svg
            role="img"
            aria-label={summary}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
            data-reduced-motion={reduceMotion ? 'true' : 'false'}
            className="h-auto w-full"
          >
            <line
              x1={PAD.left}
              y1={BASELINE_Y}
              x2={PAD.left + PLOT_W}
              y2={BASELINE_Y}
              className="stroke-stone-300 dark:stroke-stone-700"
              strokeWidth={1}
            />

            {mode === 'added' && (
              <g data-testid="growth-bars">
                {points.map((point, index) => {
                  const height = addedMax > 0 ? (point.added / addedMax) * PLOT_H : 0;
                  const x = PAD.left + index * slot + (slot - barWidth) / 2;
                  const y = BASELINE_Y - height;
                  return (
                    <m.rect
                      key={point.period}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx={2}
                      className="fill-primary dark:fill-primary-text"
                      // Grow up from the baseline: animate the geometry
                      // attributes (never a transform — motion forces
                      // `transform-origin: 50% 50%` on SVG, which would grow
                      // the bar from its middle).
                      initial={
                        reduceMotion
                          ? false
                          : { height: 0, attrY: BASELINE_Y, opacity: 0 }
                      }
                      animate={{ height, attrY: y, opacity: 1 }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { ...spring.default, delay: Math.min(index * 0.03, 0.4) }
                      }
                    >
                      <title>{`${formatPeriod(point.period)}: ${point.added} added`}</title>
                    </m.rect>
                  );
                })}
              </g>
            )}

            {mode === 'cumulative' && (
              <g data-testid="growth-line">
                <path
                  d={areaPath}
                  className="fill-primary/10 dark:fill-primary-text/10"
                />
                <m.path
                  d={linePath}
                  fill="none"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stroke-primary dark:stroke-primary-text"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={reduceMotion ? { duration: 0 } : spring.default}
                />
                {lineCoords.map(([x, y], index) => (
                  <circle
                    key={points[index].period}
                    cx={x}
                    cy={y}
                    r={3}
                    className="fill-primary dark:fill-primary-text"
                  >
                    <title>{`${formatPeriod(points[index].period)}: ${points[index].cumulative} total`}</title>
                  </circle>
                ))}
              </g>
            )}

            <text
              x={PAD.left}
              y={VIEW_H - 8}
              className="fill-stone-600 text-xs dark:fill-stone-400"
            >
              {formatPeriod(points[0].period)}
            </text>
            <text
              x={PAD.left + PLOT_W}
              y={VIEW_H - 8}
              textAnchor="end"
              className="fill-stone-600 text-xs dark:fill-stone-400"
            >
              {formatPeriod(points[points.length - 1].period)}
            </text>
          </svg>

          <table className="sr-only">
            <caption>
              Collection growth by month — records added per month and the cumulative
              collection size.
            </caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Added</th>
                <th scope="col">Cumulative total</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.period}>
                  <th scope="row">{formatPeriod(point.period)}</th>
                  <td>{point.added}</td>
                  <td>{point.cumulative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}
