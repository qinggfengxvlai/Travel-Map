const INDEX_PATH = "/index.html";
const LONG_CACHE_PATTERN =
  /\.(?:css|js|mjs|json|png|jpg|jpeg|gif|webp|svg|ico|pdf|woff2?)$/i;

function assetRequest(request, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return new Request(assetUrl, request);
}

function withCacheHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  if (!headers.has("cache-control") && LONG_CACHE_PATTERN.test(pathname)) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchAsset(env, request, pathname) {
  const response = await env.ASSETS.fetch(assetRequest(request, pathname));
  return withCacheHeaders(response, pathname);
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? INDEX_PATH : url.pathname;
    const response = await fetchAsset(env, request, pathname);
    if (response.status !== 404) return response;

    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (acceptsHtml) return fetchAsset(env, request, INDEX_PATH);

    return response;
  },
};
