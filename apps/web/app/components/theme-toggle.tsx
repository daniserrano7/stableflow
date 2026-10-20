import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { setTheme, type ThemeMode, themeCookieName } from "~/styles/tokens";
import { cn } from "~/utils/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const oneYearSeconds = 60 * 60 * 24 * 365;

// Contextual icon swap: both icons stay mounted and cross-fade (scale, opacity, blur).
const iconSwap =
  "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]";
const iconShown = "scale-100 opacity-100 blur-0";
const iconHidden = "scale-[0.25] opacity-0 blur-[4px]";

export function ThemeToggle({ initialTheme }: { initialTheme: ThemeMode }) {
  const [theme, setThemeState] = useState(initialTheme);
  const revalidator = useRevalidator();
  const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextTheme} theme`;

  const toggle = () => {
    switchThemeWithoutTransitions(nextTheme);
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not available in Firefox.
    document.cookie = `${themeCookieName}=${nextTheme}; path=/; max-age=${oneYearSeconds}; samesite=lax`;
    setThemeState(nextTheme);
    // The root loader reads the cookie, so this brings the server-rendered theme in line.
    revalidator.revalidate();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-surface-2 hover:text-foreground"
          onClick={toggle}
          type="button"
        >
          <span aria-hidden className={cn(iconSwap, theme === "dark" ? iconShown : iconHidden)}>
            <Moon size={16} strokeWidth={1.6} />
          </span>
          <span aria-hidden className={cn(iconSwap, theme === "light" ? iconShown : iconHidden)}>
            <Sun size={16} strokeWidth={1.6} />
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

// A theme flip changes colour on nearly every element at once; with their transitions running
// the page smears for 150ms instead of switching. Disable transitions for exactly one frame.
function switchThemeWithoutTransitions(mode: ThemeMode) {
  const style = document.createElement("style");
  style.append(document.createTextNode("*,*::before,*::after{transition:none !important}"));
  document.head.append(style);
  setTheme(mode);
  // Reading layout forces the new colours to resolve while transitions are still off.
  void document.body.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => style.remove());
  });
}
