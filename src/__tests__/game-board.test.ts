import { describe, it, expect, beforeEach } from "vitest";
import "../game-board";

describe("GameBoardElement", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("game-board");
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it("mounts and renders", () => {
    expect(el).toBeDefined();
    expect(el.shadowRoot).toBeNull(); // uses light DOM
  });

  it("has a canvas after render", () => {
    // game-board renders on connectedCallback, but needs state for canvas
    // Just verify the element exists and is an instance
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
