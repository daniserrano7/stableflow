import { Check, Copy, ExternalLink, Sparkles, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";

export function McpConnectWidget({ mcpUrl }: { mcpUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    if (!mcpUrl) return;
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          className="fixed right-4 bottom-4 z-30 inline-flex cursor-pointer items-center gap-2 rounded-full border border-accent/40 bg-surface-2 px-4 py-2.5 font-mono text-xs text-foreground shadow-lg shadow-black/30 transition-colors hover:border-accent hover:bg-surface-3 sm:right-6 sm:bottom-6"
          type="button"
        >
          <Sparkles aria-hidden size={15} className="text-accent" />
          Connect AI
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-surface-1 p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Public MCP server</p>
              <DialogPrimitive.Title className="text-xl font-semibold text-foreground">
                Explore Stableflow in your chat
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Close connection instructions"
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              type="button"
            >
              <X aria-hidden size={17} />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Add our read-only Base USDC data tools to a supported ChatGPT or Claude account. No
            Stableflow login or API key is needed.
          </DialogPrimitive.Description>

          {mcpUrl ? (
            <div className="mt-5">
              <p className="eyebrow mb-2">Server URL</p>
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background p-2">
                <code className="min-w-0 flex-1 overflow-x-auto px-1 font-mono text-xs text-accent">
                  {mcpUrl}
                </code>
                <button
                  aria-label={copied ? "MCP URL copied" : "Copy MCP URL"}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-foreground hover:border-accent"
                  onClick={copyUrl}
                  type="button"
                >
                  {copied ? <Check aria-hidden size={13} /> : <Copy aria-hidden size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
              The public endpoint will appear here when Stableflow is deployed.
            </p>
          )}

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <h3 className="font-semibold text-foreground">ChatGPT</h3>
              <p className="mt-1.5 text-muted-foreground">
                Enable Developer mode, then add a custom plugin using the server URL.
              </p>
              <a
                className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                href="https://developers.openai.com/plugins/deploy/connect-chatgpt"
                rel="noopener noreferrer"
                target="_blank"
              >
                Setup guide <ExternalLink aria-hidden size={12} />
              </a>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <h3 className="font-semibold text-foreground">Claude</h3>
              <p className="mt-1.5 text-muted-foreground">
                Go to Customize → Connectors → Add custom connector and paste the URL.
              </p>
              <a
                className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp"
                rel="noopener noreferrer"
                target="_blank"
              >
                Setup guide <ExternalLink aria-hidden size={12} />
              </a>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Tools can only read indexed data. Coverage starts when production indexing begins; there
            is no historical backfill. Your chat provider may require a supported plan or workspace
            setting, and your own model usage applies.
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
