import type * as React from "react";
import { cn } from "~/utils/cn";

interface VisualMarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  fallback: React.ReactNode;
  imageUrl?: string;
  imageName?: string;
}

export function VisualMark({
  className,
  fallback,
  imageName,
  imageUrl,
  style,
  ...props
}: VisualMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      style={style}
      {...props}
    >
      {fallback}
      {imageUrl && (
        <img
          alt=""
          className="absolute inset-0 size-full bg-white object-cover"
          loading="lazy"
          onError={(event) => event.currentTarget.remove()}
          referrerPolicy="no-referrer"
          src={imageUrl}
          title={imageName}
        />
      )}
    </span>
  );
}
