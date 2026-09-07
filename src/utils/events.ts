export function emitEvent(
  target: EventTarget,
  name: string,
  detail?: unknown,
): void {
  target.dispatchEvent(
    new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true,
    }),
  );
}
