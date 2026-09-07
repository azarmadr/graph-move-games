const DEV = import.meta.env.DEV;

export function dlog(msg: string) {
  if (!DEV) return;
  const el = document.getElementById("dbg");
  if (!el) return;
  const t = performance.now().toFixed(0);
  el.innerHTML += `<div>${t}ms ${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}
