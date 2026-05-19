import type { EntityListResponse } from "@stableflow/shared";
import { Link, useLoaderData } from "react-router";
import { getApiUrl } from "../../config/api.server";

export function meta() {
  return [
    { title: "Entities | Stableflow" },
    {
      content: "Known and discovered entities tracked by Stableflow.",
      name: "description",
    },
  ];
}

export async function loader(): Promise<EntityListResponse> {
  const response = await fetch(getApiUrl("/entities"), {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Response("Unable to load entities", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  return response.json() as Promise<EntityListResponse>;
}

export default function Entities() {
  const entities = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-8 pb-14 md:px-6">
      <header className="grid gap-6 pt-10 pb-8">
        <Link className="font-semibold text-accent" to="/">
          Stableflow
        </Link>
        <div>
          <p className="eyebrow">Entity registry</p>
          <h1 className="m-0 max-w-none text-5xl leading-none md:text-7xl">Tracked entities</h1>
          <p className="mt-5 mb-0 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            A first server-rendered read model from the API, backed by indexed address labels.
          </p>
        </div>
      </header>

      <section
        className="mb-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3"
        aria-label="Entity summary"
      >
        <div className="bg-glass p-5">
          <dt className="mb-2 font-mono text-2xs text-muted-foreground uppercase tracking-widest">
            Total entities
          </dt>
          <dd className="m-0 text-2xl font-medium text-foreground">
            {entities.meta.totalEntities}
          </dd>
        </div>
        <div className="bg-glass p-5">
          <dt className="mb-2 font-mono text-2xs text-muted-foreground uppercase tracking-widest">
            Total labels
          </dt>
          <dd className="m-0 text-2xl font-medium text-foreground">{entities.meta.totalLabels}</dd>
        </div>
        <div className="bg-glass p-5">
          <dt className="mb-2 font-mono text-2xs text-muted-foreground uppercase tracking-widest">
            Categories
          </dt>
          <dd className="m-0 text-2xl font-medium text-foreground">
            {entities.meta.categories.length}
          </dd>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="categories-title">
        <h2 id="categories-title" className="mt-0 mb-4 text-xl">
          Categories
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          {entities.meta.categories.map((category) => (
            <article
              className="min-w-0 rounded-lg border border-border bg-glass p-4"
              key={category.category}
            >
              <h3 className="m-0 text-md capitalize">{category.category}</h3>
              <p className="mt-2 mb-0 text-muted-foreground">
                {category.entityCount} entities · {category.labelCount} labels
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-labelledby="entities-title">
        <h2 id="entities-title" className="mt-0 mb-4 text-xl">
          Entities
        </h2>
        <table className="w-full overflow-hidden rounded-lg border border-border border-collapse font-mono">
          <thead>
            <tr>
              <th
                className="border-border border-b bg-glass p-3.5 text-left align-top text-2xs font-medium text-muted-foreground uppercase tracking-widest"
                scope="col"
              >
                Entity
              </th>
              <th
                className="border-border border-b bg-glass p-3.5 text-left align-top text-2xs font-medium text-muted-foreground uppercase tracking-widest"
                scope="col"
              >
                Category
              </th>
              <th
                className="border-border border-b bg-glass p-3.5 text-left align-top text-2xs font-medium text-muted-foreground uppercase tracking-widest"
                scope="col"
              >
                Labels
              </th>
              <th
                className="border-border border-b bg-glass p-3.5 text-left align-top text-2xs font-medium text-muted-foreground uppercase tracking-widest"
                scope="col"
              >
                Roles
              </th>
              <th
                className="border-border border-b bg-glass p-3.5 text-left align-top text-2xs font-medium text-muted-foreground uppercase tracking-widest"
                scope="col"
              >
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {entities.data.map((entity) => (
              <tr key={entity.entityId}>
                <td className="min-w-0 border-border border-b bg-glass p-3.5 text-left align-top">
                  <Link
                    className="font-semibold text-foreground no-underline hover:text-accent"
                    to={`/entities/${entity.entityId}`}
                  >
                    {entity.entityName}
                  </Link>
                  <small className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
                    {entity.entityId}
                  </small>
                </td>
                <td className="min-w-0 border-border border-b bg-glass p-3.5 text-left align-top">
                  {entity.category}
                </td>
                <td className="min-w-0 border-border border-b bg-glass p-3.5 text-left align-top">
                  {entity.labelCount} labels / {entity.addressCount} addresses
                </td>
                <td className="min-w-0 border-border border-b bg-glass p-3.5 text-left align-top">
                  {entity.roles.join(", ")}
                </td>
                <td className="min-w-0 border-border border-b bg-glass p-3.5 text-left align-top">
                  {entity.sourceTypes.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
