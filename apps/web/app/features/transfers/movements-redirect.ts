import { redirect } from "react-router";

export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/movements/, "/transfers");
  return redirect(`${url.pathname}${url.search}`, 301);
}
