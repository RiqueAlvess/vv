export function Logo({ size = 40 }: { size?: number }) {
  const scale = size / 120;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Leaf 1 */}
      <g transform="rotate(-10, 60, 60)">
        <path
          d="M60 18 C72 22 88 32 86 55 C84 75 70 82 60 79 C56 70 55 58 57 44 C58 32 59 23 60 18Z"
          fill="#2ec4b6"
          opacity="0.93"
        />
        <path d="M60 22 C66 36 78 52 74 68" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
      </g>
      {/* Leaf 2 */}
      <g transform="rotate(110, 60, 60)">
        <path
          d="M60 18 C72 22 88 32 86 55 C84 75 70 82 60 79 C56 70 55 58 57 44 C58 32 59 23 60 18Z"
          fill="#3ddbd9"
          opacity="0.93"
        />
        <path d="M60 22 C66 36 78 52 74 68" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
      </g>
      {/* Leaf 3 */}
      <g transform="rotate(230, 60, 60)">
        <path
          d="M60 18 C72 22 88 32 86 55 C84 75 70 82 60 79 C56 70 55 58 57 44 C58 32 59 23 60 18Z"
          fill="#1a9e9e"
          opacity="0.93"
        />
        <path d="M60 22 C66 36 78 52 74 68" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
      </g>
      {/* Center */}
      <circle cx="60" cy="60" r="9" fill="#2ec4b6" opacity="0.8"/>
    </svg>
  );
}
