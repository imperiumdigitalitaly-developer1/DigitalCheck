import { STATUS_LABEL, scoreToStatus } from "@/lib/analysis/constants";

function colorForScore(score: number): string {
  if (score < 40) return "#B4483F";
  if (score < 60) return "#C97A3D";
  if (score < 75) return "#3F7D8F";
  if (score < 90) return "#1F6F64";
  return "#2F7A4F";
}

export function ScoreCircle({ score, size = 152 }: { score: number; size?: number }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = colorForScore(score);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Digital Score ${score} su 100`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E3E0D8" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="font-display"
          fontSize={size * 0.28}
          fill="#14171C"
        >
          {score}
        </text>
        <text x="50%" y="63%" textAnchor="middle" fontSize={size * 0.09} fill="#3A3F47">
          / 100
        </text>
      </svg>
      <span className="text-sm font-medium" style={{ color }}>
        {STATUS_LABEL[scoreToStatus(score)]}
      </span>
    </div>
  );
}
