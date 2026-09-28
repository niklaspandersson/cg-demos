const SMALL_SCREEN = "(max-width: 860px)";

/**
 * On a phone the demo list is a drawer behind a hamburger button, because a
 * column of thirty links takes the whole width of the screen and leaves no
 * room for the thing those links open.
 *
 * On a wide screen none of this applies: the navigation is an ordinary part
 * of the page and the button is not shown.
 */
export function setupNavMenu() {
  const header = document.querySelector<HTMLElement>("#global-header");
  const nav = document.querySelector<HTMLElement>("#demo-nav");
  const toggle = document.querySelector<HTMLButtonElement>("#nav-toggle");
  const backdrop = document.querySelector<HTMLElement>("#nav-backdrop");
  const page = document.querySelector<HTMLElement>(".scene-container");
  if (!header || !nav || !toggle || !backdrop) return;

  const small = window.matchMedia(SMALL_SCREEN);

  // The drawer starts below the header, whose height depends on the font
  // size, so it is measured rather than guessed.
  const trackHeaderHeight = () => {
    document.documentElement.style.setProperty(
      "--header-height",
      `${header.offsetHeight}px`,
    );
  };
  trackHeaderHeight();
  new ResizeObserver(trackHeaderHeight).observe(header);

  const isOpen = () => document.body.hasAttribute("data-nav-open");

  const setOpen = (open: boolean, restoreFocus = false) => {
    if (open === isOpen()) return;

    document.body.toggleAttribute("data-nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Hide demo menu" : "Show demo menu");
    backdrop.hidden = !open;

    // While the drawer covers the page, tabbing must not wander off into the
    // demo behind it. The toggle stays reachable because it is in the header.
    if (page) page.inert = open;

    if (open) nav.querySelector<HTMLElement>("[data-scene]")?.focus();
    else if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener("click", () => setOpen(!isOpen(), true));
  backdrop.addEventListener("click", () => setOpen(false, true));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) setOpen(false, true);
  });

  // Picking a demo is the whole reason the drawer was opened, so it closes.
  // Focus goes back to the button that opened it, because the entry that was
  // just clicked is now hidden and would otherwise drop focus to the body.
  nav.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-scene]")) setOpen(false, true);
  });

  // Growing past the breakpoint puts the navigation back into the page, where
  // a drawer left open would only make the body unscrollable.
  small.addEventListener("change", () => {
    if (!small.matches) setOpen(false);
  });
}
