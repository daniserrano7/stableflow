import { createContext, useContext } from "react";

export interface SearchDialogContextValue {
  openSearch: () => void;
}

export const SearchDialogContext = createContext<SearchDialogContextValue | null>(null);

export function useSearchDialog() {
  const context = useContext(SearchDialogContext);

  if (context === null) {
    throw new Error("useSearchDialog must be used inside SearchDialogProvider");
  }

  return context;
}
