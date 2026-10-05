import { redirect } from "react-router";

/** This URL served the attribution strategy document; the methodology page now covers it. */
export function loader() {
  return redirect("/methodology", 301);
}
