import { describe, it, expect } from "vitest";
import { emitEvent } from "../utils/events";

describe("emitEvent", () => {
  it("dispatches a CustomEvent with bubbles and composed", () => {
    const target = new EventTarget();
    let received: Event | null = null;
    target.addEventListener("test-event", (e) => {
      received = e;
    });

    emitEvent(target, "test-event", { value: 42 });

    expect(received).not.toBeNull();
    expect(received).toBeInstanceOf(CustomEvent);
    expect((received as CustomEvent).detail).toEqual({ value: 42 });
    expect(received!.bubbles).toBe(true);
    expect(received!.composed).toBe(true);
  });

  it("dispatches event without detail", () => {
    const target = new EventTarget();
    let fired = false;
    target.addEventListener("simple", () => {
      fired = true;
    });

    emitEvent(target, "simple");
    expect(fired).toBe(true);
  });
});
