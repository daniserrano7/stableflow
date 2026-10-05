import { useId } from "react";

/**
 * The Stableflow mark, inline so pages don't wait on a request for it. Same artwork as
 * public/brand-icon.svg, which stays for the favicon and manifest.
 */
export function BrandMark({ className }: { className?: string }) {
  const gradientId = useId();

  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 32 32">
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1="4"
          x2="28"
          y1="4"
          y2="28"
        >
          <stop stopColor="#5ce1ff" />
          <stop offset="1" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <rect fill={`url(#${gradientId})`} height="32" rx="9" width="32" />
      <path
        d="M6 21 C 12 21, 12 11, 19 11 S 27 17, 27 17"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeOpacity="0.75"
        strokeWidth="1.6"
      />
      <path
        d="M5 26 C 11 26, 14 16, 20 16 S 27 22, 27 22"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeOpacity="0.4"
        strokeWidth="1.6"
      />
    </svg>
  );
}
