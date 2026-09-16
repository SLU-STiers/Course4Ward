/**
 * Hand-rolled SVG/CSS chart primitives for the admin reporting section.
 *
 * The project ships no charting library, and the dashboards are all inline
 * style maps, so these primitives deliberately match that: a fixed logical
 * viewBox scaled to the card width, theme tokens for colour, and plain
 * `<title>` elements for hover detail. No dependency, no build config.
 */

import type { CSSProperties } from 'react';
import type { ActivityTrendPoint, ReportPipelineStage } from '../../types';
import { segmentColor } from './chartTheme';
import { styles } from './styles';

export interface ChartSegment {
  key: string;
  label: string;
  value: number;
  color?: string;
}

// ---------------------------------------------------------------------------
// Trend chart (two series over the selected buckets)
// ---------------------------------------------------------------------------

const VIEW_W = 720;
const VIEW_H = 190;
const PAD = { top: 12, right: 14, bottom: 26, left: 38 };
const MAX_X_LABELS = 6;
const TICK_FONT = 11;

// The trend chart lives in the dashboard's narrow reporting column (~360px).
// An SVG scales its text with the viewBox, so a 720-wide box squeezed into that
// column would render the axis labels at half size — hence its own small box.
const TREND_W = 440;
const TREND_H = 150;
const TREND_PAD = { top: 10, right: 10, bottom: 24, left: 30 };
const TREND_LABELS = 5;

export function TrendChart({ points }: { points: ActivityTrendPoint[] }) {
  const innerW = TREND_W - TREND_PAD.left - TREND_PAD.right;
  const innerH = TREND_H - TREND_PAD.top - TREND_PAD.bottom;
  const max = Math.max(1, ...points.map((point) => Math.max(point.activity, point.orders)));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const x = (index: number) => TREND_PAD.left + index * stepX;
  const y = (value: number) => TREND_PAD.top + innerH - (value / max) * innerH;

  const line = (pick: (point: ActivityTrendPoint) => number) =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(pick(point)).toFixed(1)}`)
      .join(' ');

  const areaPath = `${line((point) => point.activity)} L${x(points.length - 1).toFixed(1)},${(
    TREND_PAD.top + innerH
  ).toFixed(1)} L${x(0).toFixed(1)},${(TREND_PAD.top + innerH).toFixed(1)} Z`;

  const gridValues = [0, 0.5, 1].map((fraction) => Math.round(max * fraction));
  const labelStride = Math.max(1, Math.ceil(points.length / TREND_LABELS));

  return (
    <div style={styles.chartWrap}>
      <svg
        viewBox={`0 0 ${TREND_W} ${TREND_H}`}
        style={styles.chartSvg}
        role="img"
        aria-label={`Activity trend across ${points.length} periods`}
      >
        {gridValues.map((value) => (
          <g key={`grid-${value}`}>
            <line
              x1={TREND_PAD.left}
              x2={TREND_W - TREND_PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--c4w-color-border, #e2e8f0)"
              strokeWidth={1}
            />
            <text
              x={TREND_PAD.left - 5}
              y={y(value) + 3}
              textAnchor="end"
              fontSize={TICK_FONT}
              fill="#64748b"
            >
              {value}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="var(--c4w-color-primary-soft, #eff6ff)" opacity={0.9} />
        <path
          d={line((point) => point.activity)}
          fill="none"
          stroke="var(--c4w-color-primary, #2563eb)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          d={line((point) => point.orders)}
          fill="none"
          stroke="var(--c4w-color-success, #15803d)"
          strokeWidth={1.6}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <g key={point.period}>
            <circle cx={x(index)} cy={y(point.activity)} r={2.4} fill="var(--c4w-color-primary, #2563eb)">
              <title>{`${point.period}: ${point.activity} logged ${point.activity === 1 ? 'action' : 'actions'}`}</title>
            </circle>
            <circle cx={x(index)} cy={y(point.orders)} r={2} fill="var(--c4w-color-success, #15803d)">
              <title>{`${point.period}: ${point.orders} ${point.orders === 1 ? 'order' : 'orders'} written`}</title>
            </circle>
          </g>
        ))}

        {points.map((point, index) =>
          index % labelStride === 0 ? (
            <text
              key={`label-${point.period}`}
              x={x(index)}
              y={TREND_H - 7}
              textAnchor="middle"
              fontSize={TICK_FONT}
              fill="#64748b"
            >
              {shortPeriod(point.period)}
            </text>
          ) : null,
        )}
      </svg>

      <div style={styles.chartLegend}>
        <LegendItem color="var(--c4w-color-primary, #2563eb)" label="Logged actions" />
        <LegendItem color="var(--c4w-color-success, #15803d)" label="Orders written" />
      </div>
    </div>
  );
}

/**
 * `YYYY-MM-DD` -> `MM-DD` for the axis.
 *
 * A plain string slice: parsing the bucket key into a `Date` would move it a
 * day in any non-UTC timezone, and these keys are UTC calendar dates.
 */
function shortPeriod(period: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(period) ? period.slice(5) : period;
}

function LegendItem({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span style={styles.chartLegendItem}>
      <span style={{ ...styles.chartLegendSwatch, backgroundColor: color }} aria-hidden="true" />
      <span>{label}</span>
      {value ? <strong style={styles.chartLegendValue}>{value}</strong> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar list (best for labelled counts, e.g. action breakdown)
// ---------------------------------------------------------------------------

export function BarList({
  rows,
  labelOf,
  limit,
  emptyLabel = 'No data in this range',
}: {
  rows: Array<{ key: string; label?: string; count: number }>;
  labelOf?: (key: string) => string;
  /** Keep only the largest N rows; the share still uses the full total. */
  limit?: number;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const shown = limit ? rows.slice(0, limit) : rows;

  if (!rows.length) {
    return <p style={styles.reportEmpty}>{emptyLabel}</p>;
  }

  return (
    <div>
      {shown.map((row, index) => (
        <div key={row.key} style={styles.barListRow}>
          <span style={styles.barListLabel}>
            {labelOf ? labelOf(row.key) : (row.label ?? row.key)}
          </span>
          <span style={styles.barListTrack}>
            <span
              style={{
                ...styles.barListFill,
                width: `${Math.max(2, (row.count / max) * 100)}%`,
                backgroundColor: segmentColor(index),
              }}
            />
          </span>
          <span style={styles.barListValue}>
            {row.count}
            <span style={styles.barListShare}>
              {total ? ` · ${Math.round((row.count / total) * 100)}%` : ''}
            </span>
          </span>
        </div>
      ))}
      {shown.length < rows.length ? (
        <p style={styles.graphNote}>
          Showing the top {shown.length} of {rows.length} categories.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column chart (one bar per bucket — used for activity per day)
// ---------------------------------------------------------------------------

export function ColumnChart({
  points,
  emptyLabel = 'Nothing to chart yet',
}: {
  points: Array<{ key: string; count: number }>;
  emptyLabel?: string;
}) {
  if (!points.length) return <p style={styles.reportEmpty}>{emptyLabel}</p>;

  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;
  const max = Math.max(1, ...points.map((point) => point.count));
  const slot = innerW / points.length;
  const barWidth = Math.max(2, Math.min(26, slot * 0.62));
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH;
  const gridValues = [0, 0.5, 1].map((fraction) => Math.round(max * fraction));
  const labelStride = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));

  return (
    <div style={styles.chartWrap}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={styles.chartSvg}
        role="img"
        aria-label={`Activity across ${points.length} buckets`}
      >
        {gridValues.map((value) => (
          <g key={`grid-${value}`}>
            <line
              x1={PAD.left}
              x2={VIEW_W - PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--c4w-color-border, #e2e8f0)"
              strokeWidth={1}
            />
            <text x={PAD.left - 6} y={y(value) + 3} textAnchor="end" fontSize={TICK_FONT} fill="#64748b">
              {value}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const centre = PAD.left + slot * index + slot / 2;
          const height = Math.max(1, (point.count / max) * innerH);
          return (
            <g key={point.key}>
              <rect
                x={centre - barWidth / 2}
                y={PAD.top + innerH - height}
                width={barWidth}
                height={height}
                rx={2}
                fill="var(--c4w-color-primary, #2563eb)"
              >
                <title>{`${point.key}: ${point.count} ${point.count === 1 ? 'action' : 'actions'}`}</title>
              </rect>
              {index % labelStride === 0 ? (
                <text x={centre} y={VIEW_H - 6} textAnchor="middle" fontSize={TICK_FONT} fill="#64748b">
                  {shortPeriod(point.key)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut (share of a whole)
// ---------------------------------------------------------------------------

const DONUT_SIZE = 124;
const DONUT_STROKE = 14;

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: ChartSegment[];
  centerValue: string;
  centerLabel: string;
}) {
  const drawn = segments.filter((segment) => segment.value > 0);
  const total = drawn.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  // Each arc needs the sum of the ones before it. Computed up front (rather
  // than with a running total inside the map) so nothing mutates during render.
  const lengths = drawn.map((segment) => (segment.value / total) * circumference);
  const arcs = drawn.map((segment, index) => ({
    segment,
    index,
    length: lengths[index],
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }));

  return (
    <div style={styles.donutWrap}>
      <svg
        viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
        style={styles.donutSvg}
        role="img"
        aria-label={`${centerLabel}: ${centerValue}`}
      >
        <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
          <circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={radius}
            fill="none"
            stroke="var(--c4w-color-surface-muted, #f1f5f9)"
            strokeWidth={DONUT_STROKE}
          />
          {arcs.map(({ segment, index, length, offset }) => (
            <circle
              key={segment.key}
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={radius}
              fill="none"
              stroke={segment.color ?? segmentColor(index)}
              strokeWidth={DONUT_STROKE}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            >
              <title>{`${segment.label}: ${segment.value}`}</title>
            </circle>
          ))}
        </g>
        <text
          x={DONUT_SIZE / 2}
          y={DONUT_SIZE / 2 - 2}
          textAnchor="middle"
          fontSize={20}
          fontWeight={800}
          fill="#0f172a"
        >
          {centerValue}
        </text>
        <text
          x={DONUT_SIZE / 2}
          y={DONUT_SIZE / 2 + 14}
          textAnchor="middle"
          fontSize={10}
          fill="#64748b"
        >
          {centerLabel}
        </text>
      </svg>

      <div style={styles.donutLegend}>
        {segments.map((segment, index) => (
          <LegendItem
            key={segment.key}
            color={segment.color ?? segmentColor(index)}
            label={segment.label}
            value={String(segment.value)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel (workflow drop-off)
// ---------------------------------------------------------------------------

export function FunnelChart({ stages }: { stages: ReportPipelineStage[] }) {
  const base = Math.max(1, stages[0]?.count ?? 1);

  return (
    <div>
      {stages.map((stage, index) => {
        const previous = index === 0 ? stage.count : stages[index - 1].count;
        const conversion = previous > 0 ? Math.round((stage.count / previous) * 100) : null;
        return (
          <div key={stage.key} style={styles.funnelRow}>
            <span style={styles.funnelLabel}>{stage.label}</span>
            <span style={styles.funnelTrack}>
              <span
                style={{
                  ...styles.funnelBar,
                  width: `${Math.max(2, (stage.count / base) * 100)}%`,
                  backgroundColor: segmentColor(index),
                }}
              />
            </span>
            <span style={styles.funnelValue}>
              {stage.count}
              {index > 0 && conversion !== null ? (
                <span style={styles.funnelConversion}>{conversion}% of previous</span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers shared by the reporting cards
// ---------------------------------------------------------------------------

/** Key/value rows for a small distribution (status counts). */
export function StatRows({
  rows,
  emptyLabel = 'Nothing recorded yet',
}: {
  rows: Array<{ key: string; label: string; value: number | string; style?: CSSProperties }>;
  emptyLabel?: string;
}) {
  if (!rows.length) return <p style={styles.reportEmpty}>{emptyLabel}</p>;

  return (
    <div>
      {rows.map((row) => (
        <div key={row.key} style={styles.statusRow}>
          <span style={styles.statusRowLabel}>{row.label}</span>
          <span style={{ ...styles.statusRowValue, ...row.style }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
