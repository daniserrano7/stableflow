import type * as React from "react";
import { getSizedImageUrl } from "~/config/visuals";
import { cn } from "~/utils/cn";

interface VisualMarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  fallback: React.ReactNode;
  imageUrl?: string;
  imageName?: string;
  /** Rendered width and height in CSS pixels; the image is requested at that size. */
  imageSize: number;
}

export function VisualMark({
  className,
  fallback,
  imageName,
  imageSize,
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
          decoding="async"
          height={imageSize}
          loading="lazy"
          onError={(event) => event.currentTarget.remove()}
          referrerPolicy="no-referrer"
          src={getSizedImageUrl(imageUrl, imageSize)}
          title={imageName}
          width={imageSize}
        />
      )}
    </span>
  );
}
