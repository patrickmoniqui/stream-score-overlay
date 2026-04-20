const API_BASE = 'https://api-web.nhle.com/v1';

function buildCorsHeaders(): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function buildCacheTtl(pathname: string): number {
  if (pathname.includes('/score/')) {
    return 10;
  }

  return 30;
}

function mergeHeaders(response: Response, pathname: string): Headers {
  const headers = buildCorsHeaders();
  headers.set('Content-Type', response.headers.get('Content-Type') ?? 'application/json');
  headers.set('Cache-Control', `public, max-age=${buildCacheTtl(pathname)}`);
  return headers;
}

async function proxyRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/^\/api/, '');

  if (!pathname.startsWith('/score/') && !pathname.startsWith('/schedule/')) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: buildCorsHeaders(),
    });
  }

  const upstreamUrl = `${API_BASE}${pathname}${url.search}`;
  const cache = caches.default;
  const cacheKey = new Request(upstreamUrl, { method: 'GET' });
  const cached = await cache.match(cacheKey);

  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: mergeHeaders(cached, pathname),
    });
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: {
      Accept: 'application/json',
    },
    cf: {
      cacheTtl: buildCacheTtl(pathname),
      cacheEverything: true,
    },
  });

  const proxiedResponse = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: mergeHeaders(upstreamResponse, pathname),
  });

  if (upstreamResponse.ok) {
    await cache.put(cacheKey, proxiedResponse.clone());
  }

  return proxiedResponse;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(),
      });
    }

    return proxyRequest(request);
  },
};
