/** Minimal accessible SVG bar chart; last bar emphasised and labelled. */
export function BarChart({ values, labels, label, format = String }: { values: number[]; labels?: string[]; label: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...values) * 1.15;
  const w = 600, h = 200, pad = 20, gap = values.length > 10 ? 8 : 22;
  const bw = (w - pad * 2 - gap * (values.length - 1)) / values.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label={`${label}: ${values.map(format).join(", ")}`}>
      <line x1={pad} y1={170} x2={w - pad} y2={170} stroke="#dde1da" />
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * 150), x = pad + i * (bw + gap), last = i === values.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={170 - bh} width={bw} height={bh} rx={3} fill={last ? "#0b5f5c" : "#9cc8c2"} />
            {labels?.[i] && <text x={x + bw / 2} y={190} textAnchor="middle" fontSize={10} fill="#56616c" fontFamily="IBM Plex Mono">{labels[i]}</text>}
            {last && <text x={x + bw / 2} y={170 - bh - 8} textAnchor="end" fontSize={12} fontWeight={600} fill="#0b5f5c" fontFamily="IBM Plex Mono">{format(v)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
