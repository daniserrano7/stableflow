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
          className="absolute inset-0 size-full bg-white object-cover outline outline-1 -outline-offset-1 outline-white/10 in-[[data-theme=light]]:outline-black/10"
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
