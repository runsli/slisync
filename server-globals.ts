/**
 * Next.js 16 expects Web Fetch globals (Request, fetch, …).
 * Install them before `next` or `next.config` load when Node omits them
 * (Node < 18, or some tsx / IDE launch environments).
 */
function installFetchGlobals() {
  if (typeof globalThis.Request !== "undefined") return;

  type UndiciLike = {
    Request: typeof Request;
    Response: typeof Response;
    Headers: typeof Headers;
    fetch: typeof fetch;
    FormData: typeof FormData;
  };

  let undici: UndiciLike;
  try {
    undici = require("node:undici") as UndiciLike;
  } catch {
    undici = require("undici") as UndiciLike;
  }

  globalThis.Request = undici.Request;
  globalThis.Response = undici.Response;
  globalThis.Headers = undici.Headers;
  globalThis.fetch = undici.fetch;
  globalThis.FormData = undici.FormData;
}

installFetchGlobals();
