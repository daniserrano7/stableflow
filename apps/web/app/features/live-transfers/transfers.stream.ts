import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { constants, createGzip } from "node:zlib";
import { getApiUrl } from "../../config/api.server";

export async function loader({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const apiUrl = new URL(getApiUrl("/transfers/live"));

  for (const [key, value] of requestUrl.searchParams) {
    apiUrl.searchParams.set(key, value);
  }

  const headers = new Headers({ accept: "text/event-stream" });
  const lastEventId = request.headers.get("last-event-id");
  if (lastEventId !== null) headers.set("last-event-id", lastEventId);

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      headers,
      signal: request.signal,
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 204 });
    throw error;
  }

  if (!response.ok || response.body === null) {
    throw new Response("Unable to connect to transfer stream", {
      status: response.status,
      statusText: response.statusText,
    });
  }

  const reader = response.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": stream ready\n\n"));
    },
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
        } else {
          controller.enqueue(chunk.value);
        }
      } catch (error) {
        if (request.signal.aborted) {
          controller.close();
        } else {
          controller.error(error);
        }
      }
    },
    async cancel() {
      await reader.cancel();
    },
  });

  // "no-transform" keeps the server's compression middleware from buffering events.
  const streamHeaders = {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
  };

  if (!/\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")) {
    return new Response(stream, { headers: streamHeaders });
  }

  // One gzip context per connection, flushed after every event: events still arrive
  // immediately and the repeated JSON shrinks about 10x.
  const gzip = Readable.fromWeb(stream as NodeReadableStream<Uint8Array>).pipe(
    createGzip({ flush: constants.Z_SYNC_FLUSH }),
  );

  return new Response(Readable.toWeb(gzip) as ReadableStream<Uint8Array>, {
    headers: { ...streamHeaders, "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
  });
}
