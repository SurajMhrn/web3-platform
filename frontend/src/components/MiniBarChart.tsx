export interface MiniBarChartDatum {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  data: MiniBarChartDatum[];
  color?: string;
  height?: number;
  emptyMessage?: string;
}

/**
 * Small dependency-free SVG bar chart for the admin analytics panel — no
 * charting library needed for "basic" day-series counts. `viewBox` uses a
 * 0–100 width so bar positions/widths are plain percentages of the
 * available space, and `preserveAspectRatio="none"` lets CSS `width: 100%`
 * handle responsiveness.
 */
export function MiniBarChart({ data, color = '#d41317', height = 120, emptyMessage = 'No activity yet.' }: MiniBarChartProps) {
  if (data.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
        {emptyMessage}
      </p>
    );
  }

  const max = Math.max(...data.map(d => d.value), 1);
  const barSlotWidth = 100 / data.length;
  const chartAreaHeight = height - 20;

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
        role="img"
        aria-label={`Bar chart from ${data[0].label} to ${data[data.length - 1].label}`}
      >
        {data.map((d) => {
          const barHeight = (d.value / max) * chartAreaHeight;
          const x = data.indexOf(d) * barSlotWidth;
          return (
            <rect
              key={d.label}
              x={x + barSlotWidth * 0.15}
              y={chartAreaHeight - barHeight}
              width={barSlotWidth * 0.7}
              height={Math.max(barHeight, d.value > 0 ? 1 : 0)}
              fill={color}
              rx={1}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}
