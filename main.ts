import { serve } from "https://deno.land/std/http/server.ts";
import { contentType } from "https://deno.land/std/media_types/mod.ts";

const activeSockets = new Map<string, WebSocket>();

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith("/ws/")) {
    const monitorId = pathname.split("/")[2];
    if (!monitorId) {
      return new Response("monitorId is required", { status: 400 });
    }
    const { socket, response } = Deno.upgradeWebSocket(request);
    activeSockets.set(monitorId, socket);
    socket.onclose = () => {
      console.log(`WebSocket closed for monitor: ${monitorId}`);
      activeSockets.delete(monitorId);
    };
    socket.onerror = (e) => {
      console.error(`WebSocket error for monitor ${monitorId}:`, e);
      activeSockets.delete(monitorId);
    };
    socket.onopen = () => {
      console.log(`WebSocket connected for monitor: ${monitorId}`);
    };
    return response;
  }

  if (pathname.startsWith("/send/")) {
    return await handleJsonEndpoints(request);
  }

  if (pathname === "/") {
    const file = await Deno.readFile('./static/monitor_display.html');
    const type = contentType("html") || "text/plain";
    return new Response(file, {
      headers: { "content-type": type },
    });
  }

  // Fall back to serving static files
  try {
    const file = await Deno.readFile(`./static${pathname}`);
    const type = contentType(pathname.slice(pathname.lastIndexOf(".") + 1)) || "text/plain";
    return new Response(file, {
      headers: { "content-type": type },
    });
  } catch (e) {
    return new Response('Not Found', { status: 404 });
  }
};

async function handleJsonEndpoints(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  let response;

  if (!request.body) {
    return new Response("No body in request", { status: 400 });
  }

  const body = await request.json();

  if (pathname.startsWith("/send")) {
    response = await sendVecOps(body.ops);

    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
    });
  }

}

const port = 8080;
console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
await serve(handler, { port: +(Deno.env.get("PORT") ?? 8000) });
