'use client';

import { brand } from '@/lib/brand';

interface LogoImageProps {
  className?: string;
}

export function LogoImage({ className }: LogoImageProps) {
  return (
    <img
      src={brand.logoUrl}
      alt={brand.name}
      width={200}
      height={60}
      className={className}
      style={{
        objectFit: 'contain',
        width: 'auto',
        height: '100%',
        filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.35)) drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
      }}
      loading="eager"
      decoding="async"
    />
  );
}
