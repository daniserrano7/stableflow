import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/utils/cn";

const copiedFeedbackMs = 1_200;

// Both icons stay mounted and cross-fade, so the swap animates in and out without a library.
const iconSwap = "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";
const iconShown = "scale-100 opacity-100 blur-0";
const iconHidden = "scale-[0.25] opacity-0 blur-[4px]";

export function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), copiedFeedbackMs);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <Button
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={async () => {
        await navigator.clipboard?.writeText(value);
        setCopied(true);
      }}
      size="icon-sm"
      title={`Copy ${label}`}
      type="button"
      variant="ghost"
    >
      <span className="relative inline-flex">
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            iconSwap,
            copied ? iconShown : iconHidden,
          )}
        >
          <Check className="text-inflow" />
        </span>
        <span className={cn("flex", iconSwap, copied ? iconHidden : iconShown)}>
          <Copy />
        </span>
      </span>
    </Button>
  );
}
