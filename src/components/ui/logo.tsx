const DEFAULT_LOGO_URL = 'https://placehold.co/160x160/png?text=Asta';

export function Logo({ size = 40 }: { size?: number }) {
  const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || DEFAULT_LOGO_URL;

  return (
    <img
      src={logoUrl}
      alt="Asta"
      width={size}
      height={size}
      className="rounded-md object-contain"
      loading="lazy"
      onError={(event) => {
        event.currentTarget.src = DEFAULT_LOGO_URL;
      }}
    />
  );
}
