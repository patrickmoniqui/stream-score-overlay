const API_BASE = 'https://api-web.nhle.com/v1';
const TWITCH_AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';
const TWITCH_FOLLOWED_CHANNELS_URL =
  'https://api.twitch.tv/helix/channels/followed';
const SESSION_COOKIE_NAME = 'twitch_gate_session';
const OAUTH_STATE_COOKIE_NAME = 'twitch_oauth_state';

interface Env {
  ANALYTICS_DB?: D1Database;
  ANALYTICS_READ_TOKEN?: string;
  TWITCH_GATE_ENABLED?: string;
  TWITCH_ALLOWED_ORIGIN?: string;
  TWITCH_BROADCASTER_ID?: string;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  TWITCH_REDIRECT_URI?: string;
  TWITCH_SESSION_SECRET?: string;
  TWITCH_SESSION_TTL_SECONDS?: string;
  TWITCH_SUCCESS_REDIRECT_URL?: string;
}

interface TwitchTokenResponse {
  access_token: string;
  refresh_token?: string;
  scope?: string[];
  token_type: string;
}

interface TwitchValidationResponse {
  client_id: string;
  expires_in: number;
  login: string;
  scopes: string[];
  user_id: string;
}

interface TwitchFollowedChannelsResponse {
  data?: Array<{ broadcaster_id: string }>;
}

interface TwitchGateSession {
  entitled: boolean;
  exp: number;
  login: string;
  sub: string;
}

interface TwitchGateGrant {
  entitled: boolean;
  exp: number;
  sub: string;
}

interface OAuthStatePayload {
  nonce: string;
  returnTo: string;
}

interface AnalyticsEventPayload {
  appVersion?: unknown;
  buildNumber?: unknown;
  eventType?: unknown;
  installId?: unknown;
  pathname?: unknown;
  settings?: unknown;
}

interface AnalyticsSettingsPayload {
  hasUnlock?: unknown;
  layout?: unknown;
  mode?: unknown;
  playoffsOnly?: unknown;
  refreshSeconds?: unknown;
  showClock?: unknown;
  style?: unknown;
  teamCount?: unknown;
  teamsKey?: unknown;
}

interface AnalyticsEventRecord {
  appVersion: string | null;
  buildNumber: string | null;
  eventType: string;
  hasUnlock: number;
  installId: string;
  layout: string;
  mode: string;
  pathname: string;
  playoffsOnly: number;
  recordedAt: number;
  refreshSeconds: number;
  showClock: number;
  style: string;
  teamCount: number;
  teamsKey: string;
}

const ANALYTICS_EVENT_TYPES = new Set([
  'settings_opened',
  'overlay_link_copied',
  'overlay_loaded',
]);
const ANALYTICS_LAYOUTS = new Set(['compact', 'stacked']);
const ANALYTICS_MODES = new Set(['auto', 'manual']);
const ANALYTICS_STYLES = new Set(['broadcast', 'classic', 'minimal', 'arena']);

function buildPublicCorsHeaders(): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function buildAuthCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const origin =
    env.TWITCH_ALLOWED_ORIGIN?.trim() ||
    request.headers.get('Origin') ||
    new URL(request.url).origin;

  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return headers;
}

function buildAnalyticsCorsHeaders(): Headers {
  const headers = buildPublicCorsHeaders();
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  return headers;
}

function jsonResponse(
  body: unknown,
  headers: Headers,
  status = 200,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

function isTwitchGateEnabled(env: Env): boolean {
  return env.TWITCH_GATE_ENABLED === 'true';
}

function getAnalyticsDb(env: Env): D1Database | null {
  return env.ANALYTICS_DB ?? null;
}

function getSessionTtlSeconds(env: Env): number {
  const rawValue = Number(env.TWITCH_SESSION_TTL_SECONDS ?? '86400');
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 86_400;
}

function getAllowedString(value: unknown, allowedValues: Set<string>): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized || !allowedValues.has(normalized)) {
    return null;
  }

  return normalized;
}

function getOptionalString(
  value: unknown,
  fallback: string | null,
  maxLength: number,
): string | null {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maxLength);
}

function getBooleanFlag(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function getInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(maximum, Math.round(numericValue)));
}

function getCount(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getBearerToken(request: Request): string | null {
  const authorizationHeader = request.headers.get('Authorization');

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  return token || null;
}

function buildLatestAnalyticsBreakdownQuery(columnName: string): string {
  return `
    WITH latest_configs AS (
      SELECT
        install_id,
        mode,
        style,
        layout,
        refresh_seconds,
        playoffs_only,
        show_clock,
        team_count,
        teams_key,
        pathname,
        ROW_NUMBER() OVER (
          PARTITION BY install_id
          ORDER BY recorded_at DESC, id DESC
        ) AS row_number
      FROM analytics_events
      WHERE recorded_at >= ?
    )
    SELECT ${columnName} AS value, COUNT(*) AS count
    FROM latest_configs
    WHERE row_number = 1
    GROUP BY ${columnName}
    ORDER BY count DESC, value ASC
  `;
}

function parseAnalyticsEventRecord(payload: unknown): AnalyticsEventRecord | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const eventPayload = payload as AnalyticsEventPayload;
  const settings =
    eventPayload.settings && typeof eventPayload.settings === 'object'
      ? (eventPayload.settings as AnalyticsSettingsPayload)
      : {};
  const eventType = getAllowedString(
    eventPayload.eventType,
    ANALYTICS_EVENT_TYPES,
  );
  const installId = getOptionalString(eventPayload.installId, null, 128);

  if (!eventType || !installId) {
    return null;
  }

  return {
    appVersion: getOptionalString(eventPayload.appVersion, null, 32),
    buildNumber: getOptionalString(eventPayload.buildNumber, null, 32),
    eventType,
    hasUnlock: getBooleanFlag(settings.hasUnlock),
    installId,
    layout:
      getAllowedString(settings.layout, ANALYTICS_LAYOUTS) ?? 'compact',
    mode: getAllowedString(settings.mode, ANALYTICS_MODES) ?? 'auto',
    pathname: getOptionalString(eventPayload.pathname, '/', 120) ?? '/',
    playoffsOnly: getBooleanFlag(settings.playoffsOnly),
    recordedAt: Date.now(),
    refreshSeconds: getInteger(settings.refreshSeconds, 10, 1, 60),
    showClock: getBooleanFlag(settings.showClock),
    style:
      getAllowedString(settings.style, ANALYTICS_STYLES) ?? 'broadcast',
    teamCount: getInteger(settings.teamCount, 0, 0, 32),
    teamsKey: getOptionalString(settings.teamsKey, 'AUTO', 120) ?? 'AUTO',
  };
}

async function fetchAnalyticsBreakdown(
  db: D1Database,
  columnName: string,
  since: number,
): Promise<Array<{ count: number; value: string }>> {
  const result = await db
    .prepare(buildLatestAnalyticsBreakdownQuery(columnName))
    .bind(since)
    .all<Record<string, unknown>>();

  return (result.results ?? []).map((row) => ({
    count: getCount(row.count),
    value:
      row.value === null || typeof row.value === 'undefined'
        ? 'Unknown'
        : String(row.value),
  }));
}

function buildCacheTtl(pathname: string): number {
  if (pathname.includes('/score/')) {
    return 10;
  }

  return 30;
}

function mergeProxyHeaders(response: Response, pathname: string): Headers {
  const headers = buildPublicCorsHeaders();
  headers.set(
    'Content-Type',
    response.headers.get('Content-Type') ?? 'application/json',
  );
  headers.set('Cache-Control', `public, max-age=${buildCacheTtl(pathname)}`);
  return headers;
}

function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get('Cookie');

  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex === -1) {
          return [part, ''];
        }

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      }),
  );
}

function buildCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

function clearCookie(name: string): string {
  return [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Max-Age=0',
  ].join('; ');
}

function encodeBase64Url(value: string): string {
  const encoded = btoa(value);
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded =
    padding === 0 ? normalized : normalized.padEnd(normalized.length + (4 - padding), '=');
  return atob(padded);
}

async function signValue(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const bytes = new Uint8Array(signature);
  const raw = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return encodeBase64Url(raw);
}

async function createSignedToken(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const payloadString = JSON.stringify(payload);
  const encodedPayload = encodeBase64Url(payloadString);
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySignedToken<T>(
  token: string,
  secret: string,
): Promise<T | null> {
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await signValue(encodedPayload, secret);

  if (expectedSignature !== signature) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(encodedPayload)) as T;
  } catch {
    return null;
  }
}

function sanitizeReturnTo(
  request: Request,
  env: Env,
  candidate: string | null | undefined,
): string {
  const fallback =
    env.TWITCH_SUCCESS_REDIRECT_URL?.trim() ||
    env.TWITCH_ALLOWED_ORIGIN?.trim() ||
    new URL(request.url).origin;

  if (!candidate) {
    return fallback;
  }

  try {
    const url = new URL(candidate, fallback);
    const allowedOrigin = env.TWITCH_ALLOWED_ORIGIN?.trim();

    if (allowedOrigin && url.origin !== new URL(allowedOrigin).origin) {
      return fallback;
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return fallback;
    }

    return url.toString();
  } catch {
    return fallback;
  }
}

async function createOAuthStatePayload(
  request: Request,
  env: Env,
  returnTo: string | null,
): Promise<OAuthStatePayload> {
  return {
    nonce: crypto.randomUUID(),
    returnTo: sanitizeReturnTo(request, env, returnTo),
  };
}

function getMissingTwitchConfig(env: Env): string[] {
  const missing: string[] = [];

  if (!env.TWITCH_CLIENT_ID) {
    missing.push('TWITCH_CLIENT_ID');
  }

  if (!env.TWITCH_CLIENT_SECRET) {
    missing.push('TWITCH_CLIENT_SECRET');
  }

  if (!env.TWITCH_REDIRECT_URI) {
    missing.push('TWITCH_REDIRECT_URI');
  }

  if (!env.TWITCH_BROADCASTER_ID) {
    missing.push('TWITCH_BROADCASTER_ID');
  }

  if (!env.TWITCH_SESSION_SECRET) {
    missing.push('TWITCH_SESSION_SECRET');
  }

  return missing;
}

async function exchangeCodeForToken(
  code: string,
  env: Env,
): Promise<TwitchTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID!,
    client_secret: env.TWITCH_CLIENT_SECRET!,
    code,
    grant_type: 'authorization_code',
    redirect_uri: env.TWITCH_REDIRECT_URI!,
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Twitch token exchange failed with ${response.status}`);
  }

  return response.json() as Promise<TwitchTokenResponse>;
}

async function validateTwitchToken(
  accessToken: string,
): Promise<TwitchValidationResponse> {
  const response = await fetch(TWITCH_VALIDATE_URL, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Twitch token validation failed with ${response.status}`);
  }

  return response.json() as Promise<TwitchValidationResponse>;
}

async function checkTwitchFollow(
  accessToken: string,
  clientId: string,
  userId: string,
  broadcasterId: string,
): Promise<boolean> {
  const url = new URL(TWITCH_FOLLOWED_CHANNELS_URL);
  url.searchParams.set('user_id', userId);
  url.searchParams.set('broadcaster_id', broadcasterId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  });

  if (!response.ok) {
    throw new Error(`Twitch follower check failed with ${response.status}`);
  }

  const payload =
    (await response.json()) as TwitchFollowedChannelsResponse;

  return Array.isArray(payload.data) && payload.data.length > 0;
}

async function getSessionFromRequest(
  request: Request,
  env: Env,
): Promise<TwitchGateSession | null> {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token || !env.TWITCH_SESSION_SECRET) {
    return null;
  }

  const session = await verifySignedToken<TwitchGateSession>(
    token,
    env.TWITCH_SESSION_SECRET,
  );

  if (!session) {
    return null;
  }

  if (session.exp <= Date.now()) {
    return null;
  }

  return session;
}

async function createOverlayGrant(
  session: TwitchGateSession,
  secret: string,
): Promise<string> {
  const grant = {
    entitled: session.entitled,
    exp: session.exp,
    sub: session.sub,
  } satisfies TwitchGateGrant;

  return createSignedToken(grant, secret);
}

async function handleAnalyticsEvent(
  request: Request,
  env: Env,
): Promise<Response> {
  const headers = buildAnalyticsCorsHeaders();
  const analyticsDb = getAnalyticsDb(env);

  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers,
    });
  }

  if (!analyticsDb) {
    return jsonResponse(
      {
        enabled: false,
        stored: false,
      },
      headers,
      202,
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(
      {
        error: 'Invalid analytics payload.',
      },
      headers,
      400,
    );
  }

  const analyticsEvent = parseAnalyticsEventRecord(payload);

  if (!analyticsEvent) {
    return jsonResponse(
      {
        error: 'Invalid analytics event.',
      },
      headers,
      400,
    );
  }

  try {
    await analyticsDb
      .prepare(
        `
          INSERT INTO analytics_events (
            recorded_at,
            event_type,
            install_id,
            pathname,
            app_version,
            build_number,
            mode,
            style,
            layout,
            refresh_seconds,
            playoffs_only,
            show_clock,
            team_count,
            teams_key,
            has_unlock
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        analyticsEvent.recordedAt,
        analyticsEvent.eventType,
        analyticsEvent.installId,
        analyticsEvent.pathname,
        analyticsEvent.appVersion,
        analyticsEvent.buildNumber,
        analyticsEvent.mode,
        analyticsEvent.style,
        analyticsEvent.layout,
        analyticsEvent.refreshSeconds,
        analyticsEvent.playoffsOnly,
        analyticsEvent.showClock,
        analyticsEvent.teamCount,
        analyticsEvent.teamsKey,
        analyticsEvent.hasUnlock,
      )
      .run();
  } catch {
    return jsonResponse(
      {
        error: 'Analytics storage failed.',
      },
      headers,
      500,
    );
  }

  return jsonResponse(
    {
      enabled: true,
      stored: true,
    },
    headers,
    202,
  );
}

async function handleAnalyticsSummary(
  request: Request,
  env: Env,
): Promise<Response> {
  const headers = buildAnalyticsCorsHeaders();
  const analyticsDb = getAnalyticsDb(env);

  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers,
    });
  }

  if (!analyticsDb) {
    return jsonResponse(
      {
        enabled: false,
        error: 'Analytics storage is not configured.',
      },
      headers,
      503,
    );
  }

  const configuredReadToken = env.ANALYTICS_READ_TOKEN?.trim();

  if (!configuredReadToken) {
    return jsonResponse(
      {
        enabled: true,
        error: 'ANALYTICS_READ_TOKEN is not configured.',
      },
      headers,
      503,
    );
  }

  if (getBearerToken(request) !== configuredReadToken) {
    return jsonResponse(
      {
        error: 'Unauthorized.',
      },
      headers,
      401,
    );
  }

  const url = new URL(request.url);
  const windowDays = getInteger(url.searchParams.get('days'), 30, 1, 365);
  const since = Date.now() - windowDays * 86_400_000;

  try {
    const totals = await analyticsDb
      .prepare(
        `
          SELECT
            COUNT(DISTINCT install_id) AS unique_users,
            COUNT(
              DISTINCT CASE
                WHEN event_type IN ('settings_opened', 'overlay_link_copied')
                THEN install_id
              END
            ) AS settings_users,
            COUNT(
              DISTINCT CASE
                WHEN event_type = 'overlay_loaded'
                THEN install_id
              END
            ) AS overlay_users,
            SUM(CASE WHEN event_type = 'settings_opened' THEN 1 ELSE 0 END) AS settings_views,
            SUM(CASE WHEN event_type = 'overlay_link_copied' THEN 1 ELSE 0 END) AS overlay_link_copies,
            SUM(CASE WHEN event_type = 'overlay_loaded' THEN 1 ELSE 0 END) AS overlay_loads
          FROM analytics_events
          WHERE recorded_at >= ?
        `,
      )
      .bind(since)
      .first<Record<string, unknown>>();
    const dailyResult = await analyticsDb
      .prepare(
        `
          SELECT
            strftime('%Y-%m-%d', recorded_at / 1000, 'unixepoch') AS day,
            COUNT(DISTINCT install_id) AS unique_users,
            SUM(CASE WHEN event_type = 'overlay_loaded' THEN 1 ELSE 0 END) AS overlay_loads,
            SUM(CASE WHEN event_type = 'overlay_link_copied' THEN 1 ELSE 0 END) AS overlay_link_copies
          FROM analytics_events
          WHERE recorded_at >= ?
          GROUP BY day
          ORDER BY day DESC
        `,
      )
      .bind(since)
      .all<Record<string, unknown>>();
    const pathResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'pathname',
      since,
    );
    const modeResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'mode',
      since,
    );
    const styleResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'style',
      since,
    );
    const layoutResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'layout',
      since,
    );
    const refreshResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'refresh_seconds',
      since,
    );
    const playoffsResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'playoffs_only',
      since,
    );
    const clockResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'show_clock',
      since,
    );
    const teamCountResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'team_count',
      since,
    );
    const teamsResult = await fetchAnalyticsBreakdown(
      analyticsDb,
      'teams_key',
      since,
    );

    return jsonResponse(
      {
        enabled: true,
        windowDays,
        totals: {
          overlayLoads: getCount(totals?.overlay_loads),
          overlayUsers: getCount(totals?.overlay_users),
          overlayLinkCopies: getCount(totals?.overlay_link_copies),
          settingsUsers: getCount(totals?.settings_users),
          settingsViews: getCount(totals?.settings_views),
          uniqueUsers: getCount(totals?.unique_users),
        },
        daily: (dailyResult.results ?? []).map((row) => ({
          day: typeof row.day === 'string' ? row.day : 'unknown',
          overlayLinkCopies: getCount(row.overlay_link_copies),
          overlayLoads: getCount(row.overlay_loads),
          uniqueUsers: getCount(row.unique_users),
        })),
        settings: {
          layout: layoutResult,
          mode: modeResult,
          paths: pathResult,
          playoffsOnly: playoffsResult,
          refreshSeconds: refreshResult,
          showClock: clockResult,
          style: styleResult,
          teamCount: teamCountResult,
          teams: teamsResult,
        },
      },
      headers,
    );
  } catch {
    return jsonResponse(
      {
        error: 'Analytics summary failed.',
      },
      headers,
      500,
    );
  }
}

async function proxyRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/^\/api/, '');

  if (!pathname.startsWith('/score/') && !pathname.startsWith('/schedule/')) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: buildPublicCorsHeaders(),
    });
  }

  const upstreamUrl = `${API_BASE}${pathname}${url.search}`;
  const cache = caches.default;
  const cacheKey = new Request(upstreamUrl, { method: 'GET' });
  const cached = await cache.match(cacheKey);

  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: mergeProxyHeaders(cached, pathname),
    });
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: {
      Accept: 'application/json',
    },
    cf: {
      cacheEverything: true,
      cacheTtl: buildCacheTtl(pathname),
    },
  });

  const proxiedResponse = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: mergeProxyHeaders(upstreamResponse, pathname),
  });

  if (upstreamResponse.ok) {
    await cache.put(cacheKey, proxiedResponse.clone());
  }

  return proxiedResponse;
}

async function handleTwitchStatus(request: Request, env: Env): Promise<Response> {
  const headers = buildAuthCorsHeaders(request, env);

  if (!isTwitchGateEnabled(env)) {
    return jsonResponse(
      {
        enabled: false,
        authenticated: false,
        entitled: false,
        login: null,
        userId: null,
        overlayToken: null,
      },
      headers,
    );
  }

  const session = await getSessionFromRequest(request, env);

  if (!session) {
    headers.append('Set-Cookie', clearCookie(SESSION_COOKIE_NAME));
  }

  return jsonResponse(
    {
      enabled: true,
      authenticated: !!session,
      entitled: !!session?.entitled,
      login: session?.login ?? null,
      userId: session?.sub ?? null,
      overlayToken:
        session?.entitled && env.TWITCH_SESSION_SECRET
          ? await createOverlayGrant(session, env.TWITCH_SESSION_SECRET)
          : null,
    },
    headers,
  );
}

async function handleTwitchVerify(request: Request, env: Env): Promise<Response> {
  const headers = buildAuthCorsHeaders(request, env);

  if (!isTwitchGateEnabled(env)) {
    return jsonResponse(
      {
        enabled: false,
        entitled: false,
        valid: false,
        userId: null,
      },
      headers,
    );
  }

  const token = new URL(request.url).searchParams.get('token');

  if (!token || !env.TWITCH_SESSION_SECRET) {
    return jsonResponse(
      {
        enabled: true,
        entitled: false,
        valid: false,
        userId: null,
      },
      headers,
    );
  }

  const grant = await verifySignedToken<TwitchGateGrant>(
    token,
    env.TWITCH_SESSION_SECRET,
  );

  if (!grant || grant.exp <= Date.now() || !grant.entitled) {
    return jsonResponse(
      {
        enabled: true,
        entitled: false,
        valid: false,
        userId: grant?.sub ?? null,
      },
      headers,
    );
  }

  return jsonResponse(
    {
      enabled: true,
      entitled: true,
      valid: true,
      userId: grant.sub,
    },
    headers,
  );
}

async function handleTwitchLogin(request: Request, env: Env): Promise<Response> {
  if (!isTwitchGateEnabled(env)) {
    return new Response('Twitch gate disabled', { status: 404 });
  }

  const missing = getMissingTwitchConfig(env);

  if (missing.length) {
    return new Response(
      `Missing Twitch gate config: ${missing.join(', ')}`,
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const statePayload = await createOAuthStatePayload(
    request,
    env,
    url.searchParams.get('return_to'),
  );

  const authorizeUrl = new URL(TWITCH_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', env.TWITCH_CLIENT_ID!);
  authorizeUrl.searchParams.set('redirect_uri', env.TWITCH_REDIRECT_URI!);
  authorizeUrl.searchParams.set('scope', 'user:read:follows');
  authorizeUrl.searchParams.set('force_verify', 'true');
  authorizeUrl.searchParams.set('state', statePayload.nonce);

  const response = new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
    },
  });

  response.headers.append(
    'Set-Cookie',
    buildCookie(
      OAUTH_STATE_COOKIE_NAME,
      encodeBase64Url(JSON.stringify(statePayload)),
      600,
    ),
  );

  return response;
}

function appendAuthResult(target: string, result: string): string {
  const url = new URL(target);
  url.searchParams.set('twitch', result);
  return url.toString();
}

async function handleTwitchCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const cookies = parseCookies(request);
  const encodedStateCookie = cookies[OAUTH_STATE_COOKIE_NAME];
  const requestUrl = new URL(request.url);

  let statePayload: OAuthStatePayload | null = null;

  if (encodedStateCookie) {
    try {
      statePayload = JSON.parse(
        decodeBase64Url(encodedStateCookie),
      ) as OAuthStatePayload;
    } catch {
      statePayload = null;
    }
  }

  const returnTo = sanitizeReturnTo(
    request,
    env,
    statePayload?.returnTo ?? requestUrl.searchParams.get('return_to'),
  );

  const responseHeaders = new Headers({
    Location: appendAuthResult(returnTo, 'error'),
  });
  responseHeaders.append('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE_NAME));

  if (!isTwitchGateEnabled(env)) {
    return new Response(null, {
      status: 302,
      headers: responseHeaders,
    });
  }

  const missing = getMissingTwitchConfig(env);

  if (missing.length) {
    return new Response(
      `Missing Twitch gate config: ${missing.join(', ')}`,
      { status: 500 },
    );
  }

  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  const authorizationError = requestUrl.searchParams.get('error');

  if (
    authorizationError ||
    !code ||
    !statePayload ||
    !state ||
    statePayload.nonce !== state
  ) {
    responseHeaders.set(
      'Location',
      appendAuthResult(returnTo, authorizationError ? 'denied' : 'invalid'),
    );

    return new Response(null, {
      status: 302,
      headers: responseHeaders,
    });
  }

  try {
    const tokenPayload = await exchangeCodeForToken(code, env);
    const validation = await validateTwitchToken(tokenPayload.access_token);
    const entitled = await checkTwitchFollow(
      tokenPayload.access_token,
      env.TWITCH_CLIENT_ID!,
      validation.user_id,
      env.TWITCH_BROADCASTER_ID!,
    );

    const session = {
      entitled,
      exp: Date.now() + getSessionTtlSeconds(env) * 1000,
      login: validation.login,
      sub: validation.user_id,
    } satisfies TwitchGateSession;

    const sessionToken = await createSignedToken(
      session,
      env.TWITCH_SESSION_SECRET!,
    );

    responseHeaders.append(
      'Set-Cookie',
      buildCookie(
        SESSION_COOKIE_NAME,
        sessionToken,
        getSessionTtlSeconds(env),
      ),
    );
    responseHeaders.set(
      'Location',
      appendAuthResult(returnTo, entitled ? 'connected' : 'not_following'),
    );

    return new Response(null, {
      status: 302,
      headers: responseHeaders,
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: responseHeaders,
    });
  }
}

function handleTwitchLogout(request: Request, env: Env): Response {
  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnTo(
    request,
    env,
    requestUrl.searchParams.get('return_to'),
  );

  const headers = new Headers({
    Location: appendAuthResult(returnTo, 'signed_out'),
  });
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE_NAME));
  headers.append('Set-Cookie', clearCookie(OAUTH_STATE_COOKIE_NAME));

  return new Response(null, {
    status: 302,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (url.pathname.startsWith('/auth/twitch/')) {
        return new Response(null, {
          status: 204,
          headers: buildAuthCorsHeaders(request, env),
        });
      }

      if (url.pathname.startsWith('/api/analytics/')) {
        return new Response(null, {
          status: 204,
          headers: buildAnalyticsCorsHeaders(),
        });
      }

      return new Response(null, {
        status: 204,
        headers: buildPublicCorsHeaders(),
      });
    }

    if (url.pathname === '/auth/twitch/status') {
      return handleTwitchStatus(request, env);
    }

    if (url.pathname === '/auth/twitch/login') {
      return handleTwitchLogin(request, env);
    }

    if (url.pathname === '/auth/twitch/callback') {
      return handleTwitchCallback(request, env);
    }

    if (url.pathname === '/auth/twitch/logout') {
      return handleTwitchLogout(request, env);
    }

    if (url.pathname === '/auth/twitch/verify') {
      return handleTwitchVerify(request, env);
    }

    if (url.pathname === '/api/analytics/events') {
      return handleAnalyticsEvent(request, env);
    }

    if (url.pathname === '/api/analytics/summary') {
      return handleAnalyticsSummary(request, env);
    }

    return proxyRequest(request);
  },
};
