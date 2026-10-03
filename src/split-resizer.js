// The saved ratio belongs to the physical left/top side, never to a tab.
export function createSplitResizer(api) {
  const { root } = api;
  const handle = document.createElement("div");
  handle.id = "split-resize-handle";
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-controls", "editor split-editor");
  handle.hidden = true;
  root.append(handle);
  let drag = null, side = "", actual = 0.5;
  const blocked = () => document.body.matches(".tab-dragging, .note-dragging, .note-external-dragging, .side-panel-resizing");
  function metrics() {
    const horizontal = ["left", "right"].includes(root.dataset.split);
    const rect = root.getBoundingClientRect();
    const available = Math.max(0, (horizontal ? root.clientWidth : root.clientHeight) - 1);
    return { horizontal, axis: horizontal ? "left" : "top", available,
      origin: horizontal ? rect.left + root.clientLeft : rect.top + root.clientTop,
      minimum: Math.min(horizontal ? 240 : 160, available / 2) };
  }
  function constrain(value, m) {
    const minimum = m.available ? m.minimum / m.available : 0.5;
    return Math.max(minimum, Math.min(1 - minimum, value));
  }
  function layout() {
    const nextSide = root.dataset.split || "";
    if (side !== nextSide) finish(false);
    side = nextSide;
    handle.hidden = !side;
    if (!side) return;
    const m = metrics();
    if (drag && drag.coordinate !== null) {
      const ratio = constrain((drag.coordinate - m.origin - drag.offset - 0.5) / (m.available || 1), m);
      api.change(m.axis, ratio);
      drag.coordinate = null;
    }
    actual = constrain(api.ratios()?.[m.axis] ?? 0.5, m);
    const first = m.available * actual;
    root.style.setProperty("--split-first-size", `${first}px`);
    handle.style.cssText = m.horizontal
      ? `left:${first - 1}px;top:0;width:3px;height:100%`
      : `top:${first - 1}px;left:0;height:3px;width:100%`;
    handle.dataset.axis = m.axis;
    handle.title = api.label();
    handle.setAttribute("aria-label", api.label());
    handle.setAttribute("aria-orientation", m.horizontal ? "vertical" : "horizontal");
    handle.setAttribute("aria-valuemin", String(Math.round(m.available ? m.minimum / m.available * 100 : 50)));
    handle.setAttribute("aria-valuemax", String(100 - Number(handle.getAttribute("aria-valuemin"))));
    handle.setAttribute("aria-valuenow", String(Math.round(actual * 100)));
  }
  function finish(applyLast = true) {
    if (!drag) return;
    if (applyLast) layout();
    if (!drag) return;
    const ended = drag;
    drag = null;
    document.body.classList.remove("split-resizing");
    document.body.style.removeProperty("--split-resize-cursor");
    if (handle.hasPointerCapture(ended.id)) handle.releasePointerCapture(ended.id);
    api.commit();
  }
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !event.isPrimary || blocked() || !side) return;
    event.preventDefault(); event.stopPropagation();
    const m = metrics();
    const coordinate = m.horizontal ? event.clientX : event.clientY;
    drag = { id: event.pointerId, horizontal: m.horizontal, coordinate: null,
      offset: coordinate - m.origin - m.available * actual - 0.5 };
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add("split-resizing");
    document.body.style.setProperty("--split-resize-cursor", m.horizontal ? "ew-resize" : "ns-resize");
  });
  handle.addEventListener("pointermove", event => {
    if (event.pointerId !== drag?.id) return;
    drag.coordinate = drag.horizontal ? event.clientX : event.clientY;
    api.schedule();
  });
  handle.addEventListener("pointerup", event => { if (event.pointerId === drag?.id) { finish(); api.schedule(); } });
  handle.addEventListener("pointercancel", () => finish(false));
  handle.addEventListener("lostpointercapture", () => finish(false));
  window.addEventListener("blur", () => finish());
  function setRatio(value) {
    if (!side || blocked()) return;
    api.change(metrics().axis, constrain(value, metrics()));
    api.schedule(); api.commit();
  }
  handle.addEventListener("dblclick", event => { event.preventDefault(); setRatio(0.5); });
  window.addEventListener("keydown", event => {
    if (drag && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(false); }
  }, true);
  return { layout, get dragging() { return Boolean(drag); } };
}
