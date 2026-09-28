import { getApiUrl } from "../../config/api.server";

export async function loader({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const apiUrl = new URL(getApiUrl("/transfers/live"));

  for (const [key, value] of requestUrl.searchParams) {
    apiUrl.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      headers: {
        accept: "text/event-stream",
      },
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

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
