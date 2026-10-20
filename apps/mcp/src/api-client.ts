const maxResponseBytes = 64 * 1024;
const timeoutMs = 8_000;

export class ApiClient {
  constructor(private readonly baseUrl: URL) {}

  async get(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl.pathname.replace(/\/$/, "")}${path}`, this.baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 404) throw new Error("No matching indexed record was found.");
      if (response.status === 400) throw new Error("The query was rejected by the indexer API.");
      throw new Error("Indexer data is temporarily unavailable. Please try again later.");
    }

    if (!response.body) throw new Error("Indexer API returned an empty response.");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteCount += value.byteLength;
        if (byteCount > maxResponseBytes) {
          throw new Error("This result is too large. Narrow the query and try again.");
        }
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }

    const bytes = new Uint8Array(byteCount);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  }
}
