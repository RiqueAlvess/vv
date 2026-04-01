'use client';

import { brand } from '@/lib/brand';

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      src={brand.logoUrl}
      alt={brand.name}
      width={size}
      height={size}
      className="rounded-md object-contain"
      loading="lazy"
    />
  );
}