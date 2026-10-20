import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

export const getTransferPath = (transferId: string) => `/transfers/${transferId}`;

/** The row's single focusable link to the transfer; row clicks mirror it via `useRowLink`. */
export function TransferRowLink({ transferId }: { transferId: string }) {
  return (
    <Link
      aria-label="View transfer details"
      className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface-3 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:text-accent"
      title="View transfer"
      to={getTransferPath(transferId)}
    >
      <ChevronRight size={14} />
    </Link>
  );
}
