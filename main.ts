import { serve } from "https://deno.land/std/http/server.ts";
import { contentType } from "https://deno.land/std/media_types/mod.ts";

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/") {
    try {
      const file = await Deno.readFile('./static/monitor_display.html');
      const type = contentType("html") || "text/plain";
      return new Response(file, {
        headers: { "content-type": type },
      });
    } catch (e) {
      console.error("Error reading ./static/monitor_display.html:", e);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // Fall back to serving other static files
  try {
    const filePath = `./static${pathname}`;
    const file = await Deno.readFile(filePath);
    // Extract file extension for contentType, handle cases with no extension
    const extension = pathname.includes('.') ? pathname.slice(pathname.lastIndexOf(".") + 1) : "";
    const type = contentType(extension) || "application/octet-stream"; // Default to octet-stream if unknown
    
    return new Response(file, {
      headers: { "content-type": type },
    });
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return new Response('Not Found', { status: 404 });
    }
    console.error(`Error reading file ${pathname}:`, e);
    return new Response('Internal Server Error', { status: 500 });
  }
};

const port = +(Deno.env.get("PORT") ?? 8000);
console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
await serve(handler, { port });
