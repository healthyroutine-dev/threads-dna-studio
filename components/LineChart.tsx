// 외부 라이브러리 없는 심플 SVG 라인 차트
export default function LineChart({
  points,
  height = 140,
}: {
  points: Array<{ label: string; value: number }>;
  height?: number;
}) {
  if (points.length < 2) {
    return <p className="text-[11px] text-muted py-6 text-center">데이터가 2일 이상 쌓이면 차트가 그려져요.</p>;
  }
  const W = 320;
  const H = height;
  const PAD = { top: 12, right: 8, bottom: 20, left: 40 };
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / range) * (H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - PAD.bottom} L${PAD.left},${H - PAD.bottom} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <text x={PAD.left - 6} y={y(max) + 4} textAnchor="end" fontSize="9" fill="#8a8578">
        {max.toLocaleString()}
      </text>
      <text x={PAD.left - 6} y={y(min) + 4} textAnchor="end" fontSize="9" fill="#8a8578">
        {min.toLocaleString()}
      </text>
      <line x1={PAD.left} y1={y(max)} x2={W - PAD.right} y2={y(max)} stroke="#e4dfd1" strokeDasharray="3 3" />
      <line x1={PAD.left} y1={y(min)} x2={W - PAD.right} y2={y(min)} stroke="#e4dfd1" strokeDasharray="3 3" />
      <path d={area} fill="#e0301e" opacity="0.08" />
      <path d={path} fill="none" stroke="#e0301e" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="3.5" fill="#e0301e" />
      <text x={PAD.left} y={H - 6} fontSize="9" fill="#8a8578">
        {points[0].label}
      </text>
      <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="9" fill="#8a8578">
        {last.label}
      </text>
    </svg>
  );
}
