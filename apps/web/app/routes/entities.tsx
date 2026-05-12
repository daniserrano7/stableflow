import type { EntityListResponse } from "@stableflow/shared";
import { Link, useLoaderData } from "react-router";
import { getApiUrl } from "../config/api.server";
import type { Route } from "./+types/entities";

export function meta(_: Route.MetaArgs) {
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
    <main className="page">
      <header className="page-header">
        <Link className="text-link" to="/">
          Stableflow
        </Link>
        <div>
          <p className="eyebrow">Entity registry</p>
          <h1>Tracked entities</h1>
          <p className="lede">
            A first server-rendered read model from the API, backed by indexed address labels.
          </p>
        </div>
      </header>

      <section className="summary-strip" aria-label="Entity summary">
        <div>
          <dt>Total entities</dt>
          <dd>{entities.meta.totalEntities}</dd>
        </div>
        <div>
          <dt>Total labels</dt>
          <dd>{entities.meta.totalLabels}</dd>
        </div>
        <div>
          <dt>Categories</dt>
          <dd>{entities.meta.categories.length}</dd>
        </div>
      </section>

      <section className="content-section" aria-labelledby="categories-title">
        <h2 id="categories-title">Categories</h2>
        <div className="category-list">
          {entities.meta.categories.map((category) => (
            <article className="compact-card" key={category.category}>
              <h3>{category.category}</h3>
              <p>
                {category.entityCount} entities · {category.labelCount} labels
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section" aria-labelledby="entities-title">
        <h2 id="entities-title">Entities</h2>
        <table className="entity-table">
          <thead>
            <tr>
              <th scope="col">Entity</th>
              <th scope="col">Category</th>
              <th scope="col">Labels</th>
              <th scope="col">Roles</th>
              <th scope="col">Sources</th>
            </tr>
          </thead>
          <tbody>
            {entities.data.map((entity) => (
              <tr key={entity.entityId}>
                <td>
                  <strong>{entity.entityName}</strong>
                  <small>{entity.entityId}</small>
                </td>
                <td>{entity.category}</td>
                <td>
                  {entity.labelCount} labels / {entity.addressCount} addresses
                </td>
                <td>{entity.roles.join(", ")}</td>
                <td>{entity.sourceTypes.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
