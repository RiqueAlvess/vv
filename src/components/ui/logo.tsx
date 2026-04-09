'use client';

/**
 * Logo component — inline SVG wordmark "Vivamente360".
 * variant="dark"  → dark teal text on light backgrounds (login page, survey page)
 * variant="light" → white text on dark backgrounds (sidebar, auth left panel)
 */
export function Logo({
  size = 40,
  variant = 'dark',
}: {
  size?: number;
  variant?: 'light' | 'dark';
}) {
  const textColor = variant === 'light' ? '#FFFFFF' : '#144660';
  // Maintain aspect ratio: original viewBox is ~340×56, so height-based scaling
  const width = Math.round((size * 340) / 56);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 340 56"
      width={width}
      height={size}
      role="img"
      aria-label="Vivamente360"
    >
      <text
        x="0"
        y="44"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="46"
        letterSpacing="-1"
      >
        <tspan fill={textColor}>Vivamente</tspan>
        <tspan fill="#1ff28d">360</tspan>
      </text>
    </svg>
  );
}
