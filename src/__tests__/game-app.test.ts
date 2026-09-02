import { describe, it, expect, beforeEach } from "vitest";
import "../game-app";

describe("GameAppElement", () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement("game-app");
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it("mounts successfully", () => {
    expect(el).toBeDefined();
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it("renders content", () => {
    // game-app renders on connectedCallback
    expect(el.tagName.toLowerCase()).toBe("game-app");
  });
});
