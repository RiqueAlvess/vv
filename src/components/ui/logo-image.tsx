'use client';

import Image from 'next/image';
import { brand } from '@/lib/brand';

interface LogoImageProps {
  className?: string;
  width?: number;
  height?: number;
}

export function LogoImage({ className, width = 120, height = 40 }: LogoImageProps) {
  return (
    <Image
      src={brand.logoUrl}
      alt={brand.name}
      width={width}
      height={height}
      className={className}
      style={{
        objectFit: 'contain',
        filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.35)) drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
      }}
      priority
    />
  );
}
