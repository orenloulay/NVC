type LogoProps = {
  size?: number;
  className?: string;
};

/**
 * NVC mark: two speech bubbles meeting to form a heart — communication (the
 * bubbles) resolving into connection and empathy (the heart), the core of
 * Nonviolent Communication.
 */
export default function Logo({ size = 72, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="NVC logo"
      className={className}
    >
      <defs>
        <linearGradient id="nvc-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      {/* Left speech bubble */}
      <path
        d="M32 52C32 52 8 38.5 8 22.5C8 14.49 14.27 8 22 8C26.66 8 30.79 10.46 33 14.2"
        stroke="url(#nvc-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right speech bubble */}
      <path
        d="M32 52C32 52 56 38.5 56 22.5C56 14.49 49.73 8 42 8C37.34 8 33.21 10.46 31 14.2"
        stroke="#f59e0b"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bubble tail — the "spoken" moment where the two meet */}
      <path
        d="M32 52L26 58L28.5 50.5"
        fill="#0d9488"
      />
      {/* Connection dots inside the heart */}
      <circle cx="24.5" cy="24" r="2.4" fill="#14b8a6" />
      <circle cx="32" cy="27" r="2.4" fill="#0d9488" />
      <circle cx="39.5" cy="24" r="2.4" fill="#f59e0b" />
    </svg>
  );
}
