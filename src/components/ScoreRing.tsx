export function ScoreRing({ score, size = 58 }: { score: number | null; size?: number }) {
  const value = score ?? 0;
  const r = size / 2 - 4.5;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const tone = value >= 65 ? '#2F6B58' : value >= 50 ? '#B87A2B' : '#98A6A0';
  return (
    <div className="score-ring shrink-0" style={{ ['--circumference' as any]: `${c}`, ['--offset' as any]: `${offset}`, width: size, height: size }} role="img" aria-label={`ציון ${value} מתוך 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E6ECE9" strokeWidth="4.5" />
        <circle className="value" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2}) scale(-1 1) translate(-${size} 0)`} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.32} fontWeight="800" fill={tone}>{score === null ? '–' : value}</text>
      </svg>
    </div>
  );
}
