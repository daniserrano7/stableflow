import type { ReactNode } from "react";

export interface PageStat {
  label: string;
  unit?: string;
  value: ReactNode;
}

/**
 * Page title on the canvas: the heading leads, a one-line description orients, and the page's
 * key numbers sit alongside. Replaces the icon-tile hero panels.
 */
export function PageHeader({
  description,
  id,
  stats,
  title,
}: {
  description?: ReactNode;
  /** Id of the <h1>; pass the same id to AppPage's headingId. */
  id: string;
  stats?: PageStat[];
  title: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 px-1 pt-2 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="m-0 text-2xl font-medium leading-tight tracking-[-0.01em]" id={id}>
          {title}
        </h1>
        {description && (
          <p className="m-0 mt-1.5 max-w-xl text-md text-muted-foreground">{description}</p>
        )}
      </div>
      {stats && stats.length > 0 && (
        // Each stat keeps a minimum width, so a live value growing a digit never nudges the others.
        <dl className="m-0 grid grid-cols-2 gap-x-8 gap-y-3 sm:auto-cols-[minmax(7.5rem,max-content)] sm:grid-flow-col sm:grid-cols-none">
          {stats.map((stat) => (
            <div className="min-w-0" key={stat.label}>
              <dt className="font-mono text-2xs text-muted-foreground uppercase tracking-[0.06em]">
                {stat.label}
              </dt>
              <dd className="m-0 mt-0.5 whitespace-nowrap font-medium text-lg tabular-nums">
                {stat.value}
                {stat.unit && (
                  <span className="ml-1 font-normal text-muted-foreground text-xs">
                    {stat.unit}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
