import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Stableflow" },
    {
      content: "USDC flow intelligence on Base.",
      name: "description",
    },
  ];
}

export default function Home() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero__content">
          <p className="eyebrow">Stableflow</p>
          <h1 id="home-title">USDC flow intelligence on Base.</h1>
          <p className="lede">
            A live view of token movement across users, protocols, bridges, and venues.
          </p>
        </div>

        <dl className="status-grid" aria-label="Current scaffold status">
          <div>
            <dt>Frontend</dt>
            <dd>React Router</dd>
          </div>
          <div>
            <dt>Rendering</dt>
            <dd>SSR ready</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>API pending</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
