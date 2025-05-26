import { serve } from "https://deno.land/std/http/server.ts";
import { contentType } from "https://deno.land/std/media_types/mod.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std/path/mod.ts";

const handler = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const { pathname } = url;
  let filePath = "";
  let fileExtensionOverride = ""; // Used for paths like /game that serve an HTML file

  const scriptDir = dirname(fromFileUrl(import.meta.url));

  if (pathname === "/") {
    filePath = join(scriptDir, 'static', 'monitor_display.html');
    fileExtensionOverride = "html";
  } else if (pathname === "/game") {
    filePath = join(scriptDir, 'static', 'game', 'game.html');
    fileExtensionOverride = "html";
  } else {
    // For all other paths, assume they are assets relative to the static directory
    // e.g. /game/main.js -> static/game/main.js relative to scriptDir
    // pathname starts with '/', e.g. /game/main.js
    // `static${pathname}` becomes `static/game/main.js`
    filePath = join(scriptDir, `static${pathname}`);
  }

  try {
    const file = await Deno.readFile(filePath);
    // Determine content type based on actual file extension or override
    const extension = fileExtensionOverride || (filePath.includes('.') ? filePath.slice(filePath.lastIndexOf(".") + 1) : "");
    const type = contentType(extension) || "application/octet-stream"; // Default if unknown
    
    return new Response(file, {
      headers: { "content-type": type },
    });
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      console.warn(`File not found: ${filePath} (requested path: ${pathname})`);
      return new Response('Not Found', { status: 404 });
    }
    console.error(`Error reading file ${filePath} (requested path: ${pathname}):`, e);
    return new Response('Internal Server Error', { status: 500 });
  }
};

const port = +(Deno.env.get("PORT") ?? 8000);
console.log(`HTTP webserver running. Access it at: http://localhost:${port}/`);
console.log(`Game available at: http://localhost:${port}/game`);
await serve(handler, { port });