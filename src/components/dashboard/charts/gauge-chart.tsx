'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface GaugeProps {
  responseRate: number;
  totalInvited: number;
  totalResponded: number;
}

export function GaugeChart({ responseRate, totalInvited, totalResponded }: GaugeProps) {
  const pct = Math.min(100, Math.max(0, responseRate));
  const angle = (pct / 100) * 180;
  const color = pct >= 70 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';

  const cx = 100, cy = 100, r = 75;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const endAngle = 180 - angle;
  const endX = cx + r * Math.cos(toRad(endAngle));
  const endY = cy + r * Math.sin(toRad(endAngle));
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Taxa de Adesão</CardTitle>
        <CardDescription>
          {totalResponded} de {totalInvited} colaboradores responderam
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <svg viewBox="0 0 200 120" className="w-full max-w-[280px]">
          {/* Background arc */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Value arc */}
          {angle > 0 && (
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
              fill="none"
              stroke={color}
              strokeWidth="16"
              strokeLinecap="round"
            />
          )}
          {/* Zone markers */}
          <text x="22" y="114" fontSize="9" fill="#94a3b8">0%</text>
          <text x="90" y="24" fontSize="9" fill="#eab308" textAnchor="middle">50%</text>
          <text x="160" y="114" fontSize="9" fill="#22c55e">100%</text>
          {/* Value text */}
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="28" fontWeight="bold" fill={color}>
            {pct.toFixed(1)}%
          </text>
          <text x={cx} y={cy + 26} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {pct >= 70 ? 'Boa adesão' : pct >= 50 ? 'Adesão moderada' : 'Baixa adesão'}
          </text>
        </svg>
        <div className="flex gap-4 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/> &lt;50% Baixa</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/> 50–70% Moderada</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/> ≥70% Boa</span>
        </div>
      </CardContent>
    </Card>
  );
}
