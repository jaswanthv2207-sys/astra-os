/**
 * Stable DOM overlay that hosts every drei `<Html>` planet label.
 *
 * drei's `Html` computes its mount target during render
 * (`portal?.current || events.connected || gl.domElement.parentNode`) and
 * puts that target in the layout-effect deps that create its internal React
 * root. Without a portal, the target changes once during scene boot (the
 * events system connects a few ms after first paint), which unmounts the
 * first root and mounts a second one on the same container — and the first
 * root's asynchronous container clear can then wipe the second root's label
 * node, orphaning it. On route exit React tries to remove the orphaned node
 * and throws `NotFoundError: Failed to execute 'removeChild'`.
 *
 * `labelPortalRef` therefore returns a div that is created on first access
 * and never changes identity, so the target is stable from the very first
 * render: one effect pass, one root, no race. The scene attaches the div
 * into the live events container (`LabelOverlayHost`); on unmount it is
 * detached and reused on the next visit.
 *
 * The overlay only exists inside the universe, which is loaded with
 * `ssr: false`, so touching `document` here is always safe.
 */

let overlay: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement {
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.setAttribute("data-label-overlay", "");
    // Same geometry as the R3F container (absolute, full-bleed) so label
    // coordinates and stacking resolve exactly as they did inline.
    overlay.style.cssText =
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;";
  }
  return overlay;
}

/** Ref-shaped handle whose `current` is stable from first access onward. */
export const labelPortalRef: { current: HTMLElement } = {
  get current(): HTMLElement {
    return ensureOverlay();
  },
};
