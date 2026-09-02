export interface ProfileResult {
  name: string;
  durationMs: number;
  iterations?: number;
}

export function measure(
  name: string,
  fn: () => void,
  iterations = 1,
): ProfileResult {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const durationMs = performance.now() - start;
  return {
    name,
    durationMs,
    iterations: iterations > 1 ? iterations : undefined,
  };
}

export async function measureAsync(
  name: string,
  fn: () => Promise<void>,
  iterations = 1,
): Promise<ProfileResult> {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const durationMs = performance.now() - start;
  return {
    name,
    durationMs,
    iterations: iterations > 1 ? iterations : undefined,
  };
}

export function printResult(result: ProfileResult): void {
  const iter = result.iterations ? ` (${result.iterations} iterations)` : "";
  const avg = result.iterations
    ? ` [avg: ${(result.durationMs / result.iterations).toFixed(3)}ms]`
    : "";
  console.log(
    `  ${result.name}: ${result.durationMs.toFixed(3)}ms${iter}${avg}`,
  );
}
