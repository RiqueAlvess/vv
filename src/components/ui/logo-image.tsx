'use client';

/**
 * LogoImage — wider/horizontal variant of the Vivamente360 wordmark.
 * Used in sidebar header and auth left panel (always on dark backgrounds → light variant).
 */
interface LogoImageProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export function LogoImage({ className, variant = 'light' }: LogoImageProps) {
  const textColor = variant === 'light' ? '#FFFFFF' : '#144660';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 380 56"
      width="100%"
      height="100%"
      role="img"
      aria-label="Vivamente360"
      className={className}
      style={{ display: 'block', maxWidth: '220px' }}
    >
      <text
        x="2"
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
