type BrandLogoProps = {
  className?: string;
  size?: number;
};

export default function BrandLogo({ className = "", size = 48 }: BrandLogoProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg aria-hidden="true" viewBox="0 0 64 64" className="h-full w-full">
        <defs>
          <linearGradient id="logo-bg" x1="9" x2="55" y1="8" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="#07152f" />
            <stop offset="1" stopColor="#102044" />
          </linearGradient>
          <linearGradient id="logo-accent" x1="17" x2="48" y1="39" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4f7cff" />
            <stop offset="1" stopColor="#1f5eff" />
          </linearGradient>
        </defs>
        <rect width="56" height="56" x="4" y="4" fill="url(#logo-bg)" rx="15" />
        <path
          d="M14 45c10 4 27-1 37-18"
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeWidth="3.5"
        />
        <path d="M20 37h5v10h-5zM29 31h5v16h-5zM38 24h5v23h-5z" fill="#ffffff" rx="2" />
        <path
          d="m17 34 12-11 8 7 13-16"
          fill="none"
          stroke="url(#logo-accent)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4.2"
        />
        <path d="m44 14 7-1-1 7" fill="none" stroke="url(#logo-accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.2" />
        <circle cx="14" cy="45" r="3" fill="#ffffff" />
        <circle cx="51" cy="27" r="3" fill="#ffffff" />
      </svg>
    </span>
  );
}
