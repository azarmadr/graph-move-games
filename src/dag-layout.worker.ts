import { makeDagLayout } from "./dag-layout";
import type { GraphData } from "./wasmBridge";

self.onmessage = (e: MessageEvent<GraphData>) => {
  try {
    const layout = makeDagLayout(e.data);
    self.postMessage({ ok: true, layout });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
