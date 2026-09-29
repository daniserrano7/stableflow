import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";

const copiedFeedbackMs = 1_200;

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
      {copied ? <Check className="text-inflow" /> : <Copy />}
    </Button>
  );
}
