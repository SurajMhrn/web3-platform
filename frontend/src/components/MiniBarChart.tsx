import { useState } from 'react';

export interface MiniBarChartDatum {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  data: MiniBarChartDatum[];
  /** A CSS colour — pass a theme token so the series restyles with the theme. */
  color?: string;
  /** Names the series for screen readers and the accessible table. */
  seriesName?: string;
  emptyMessage?: string;
}

// viewBox units. The drawing scales uniformly to the card; it is not stretched.
const VB_WIDTH = 360;
const PLOT_HEIGHT = 108;
const PLOT_TOP = 14;
const VB_HEIGHT = PLOT_TOP + PLOT_HEIGHT + 4;

/**
 * Dependency-free day-series bar chart for the admin analytics panel.
 *
 * Deliberately not stretched: an earlier version scaled a 0–100 viewBox with
 * preserveAspectRatio="none", which squashed the bars and would have distorted
 * any text drawn inside. The drawing now scales uniformly, and the bars are
 * positioned in real viewBox units.
 *
 * Colour never carries meaning alone — each chart is titled, the peak bar is
 * labelled directly, and the same numbers are available to screen readers as a
 * table — so the series stay readable under colour-vision deficiency.
 */
export function MiniBarChart({
  data,
  color = 'var(--chart-signups)',
  seriesName = 'Activity',
  emptyMessage = 'No activity yet.',
}: MiniBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
        {emptyMessage}
      </p>
    );
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, v) => sum + v, 0);
  const peakIndex = values.indexOf(max);
  const average = total / data.length;

  const slot = VB_WIDTH / data.length;
  const barWidth = Math.max(slot * 0.62, 1.5);
  const radius = Math.min(barWidth / 2, 3);
  const active = hovered !== null ? data[hovered] : null;

  return (
    <div>
      {/* Summary first: the headline numbers shouldn't require reading the bars. */}
      <div style={{ display: 'flex', gap: '1.1rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <Figure label="Total" value={total} />
        <Figure label="Peak" value={max} />
        <Figure label="Daily avg" value={average < 10 ? average.toFixed(1) : Math.round(average)} />
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          role="img"
          aria-label={`${seriesName} by day, ${data[0].label} to ${data[data.length - 1].label}. Total ${total}, peak ${max}.`}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Recessive scale: the maximum and the baseline, nothing in between. */}
          <line x1="0" y1={PLOT_TOP} x2={VB_WIDTH} y2={PLOT_TOP} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="0" y1={PLOT_TOP + PLOT_HEIGHT} x2={VB_WIDTH} y2={PLOT_TOP + PLOT_HEIGHT} stroke="var(--chart-grid)" strokeWidth="1" />
          <text x="0" y={PLOT_TOP - 4} fill="var(--text-dim)" fontSize="9" fontFamily="inherit">{max}</text>

          {data.map((d, i) => {
            const barHeight = d.value === 0 ? 0 : Math.max((d.value / max) * PLOT_HEIGHT, 2);
            const x = i * slot + (slot - barWidth) / 2;
            const y = PLOT_TOP + PLOT_HEIGHT - barHeight;
            const isActive = hovered === i;
            return (
              <g key={d.label}>
                {barHeight > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={color}
                    rx={radius}
                    opacity={hovered === null || isActive ? 1 : 0.45}
                  />
                )}
                {/* Hit target spans the full plot height so short bars stay hoverable. */}
                <rect
                  x={i * slot}
                  y={PLOT_TOP}
                  width={slot}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                />
              </g>
            );
          })}

          {/* One direct label, on the peak — never a number on every bar. */}
          {max > 0 && hovered === null && (
            <text
              x={peakIndex * slot + slot / 2}
              y={PLOT_TOP + PLOT_HEIGHT - Math.max((max / max) * PLOT_HEIGHT, 2) - 4}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="9"
              fontFamily="inherit"
            >
              {max}
            </text>
          )}
        </svg>

        {active && (
          <div
            role="status"
            style={{
              position: 'absolute',
              top: 0,
              left: `${((hovered! + 0.5) / data.length) * 100}%`,
              transform: 'translate(-50%, -105%)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
              zIndex: 5,
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>{active.label}</span>
            <span style={{ color: 'var(--text-color)', fontWeight: 700, marginLeft: '0.5rem' }}>{active.value}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>

      {/* Same numbers, reachable without seeing or hovering the chart. */}
      <table className="sr-only">
        <caption>{seriesName} by day</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
        {label}
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-color)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}
