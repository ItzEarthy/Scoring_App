const WIDTH = 320;
const HEIGHT = 96;
const PADDING = 8;

export function RatingHistoryChart({ points }: { points: number[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        Play a few more matches to see your rating trend.
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((value, i) => {
    const x = PADDING + (i / (points.length - 1)) * (WIDTH - PADDING * 2);
    const y = HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${HEIGHT - PADDING} L${coords[0][0].toFixed(1)},${HEIGHT - PADDING} Z`;
  const trendingUp = points[points.length - 1] >= points[0];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-24 w-full" preserveAspectRatio="none">
      <path d={areaPath} fill="var(--color-brand-primary)" opacity={0.08} />
      <path
        d={linePath}
        fill="none"
        stroke={trendingUp ? "var(--color-brand-primary)" : "var(--color-destructive, #e11d48)"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 3 : 1.5} fill="var(--color-brand-primary)" />
      ))}
    </svg>
  );
}
