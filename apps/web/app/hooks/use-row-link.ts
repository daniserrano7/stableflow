import { type MouseEvent, useCallback } from "react";
import { useNavigate } from "react-router";

// Rows keep one real <Link> for keyboard and screen-reader users. A click anywhere else on the
// row goes to the same place, except on the row's own links and buttons, and except when the
// click ends a text selection.
const interactiveSelector =
  "a, button, input, select, textarea, label, summary, [role='button'], [role='link']";

export function useRowLink() {
  const navigate = useNavigate();

  return useCallback(
    (href: string) => ({
      onAuxClick(event: MouseEvent<HTMLElement>) {
        if (event.button !== 1 || isInnerInteractiveTarget(event)) return;
        window.open(href, "_blank", "noopener");
      },
      onClick(event: MouseEvent<HTMLElement>) {
        if (event.defaultPrevented || event.button !== 0) return;
        if (isInnerInteractiveTarget(event) || hasTextSelection()) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          window.open(href, "_blank", "noopener");
          return;
        }
        navigate(href);
      },
    }),
    [navigate],
  );
}

const isInnerInteractiveTarget = (event: MouseEvent<HTMLElement>) => {
  const interactive = (event.target as Element).closest(interactiveSelector);
  return interactive !== null && event.currentTarget.contains(interactive);
};

const hasTextSelection = () => (window.getSelection()?.toString().length ?? 0) > 0;
