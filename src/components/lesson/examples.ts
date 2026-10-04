/**
 * Which lesson example a module's input is, if any. Inputs are compared as canonical JSON
 * (object keys sorted), so an example still counts as loaded after its input has been
 * through the share-state codec, which may rebuild objects in another key order.
 */

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

export function matchExample<I>(
  examples: readonly { id: string; input: I }[],
  input: I,
): string | null {
  const key = canonicalJson(input);
  return examples.find((e) => canonicalJson(e.input) === key)?.id ?? null;
}
