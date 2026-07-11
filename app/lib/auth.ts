// Single-user password gate. When APP_PASSWORD is set (a Worker secret),
// every page requires a session cookie signed with a key derived from that
// password; the login form sets it for ~90 days per device. Rotating the
// password invalidates every session. When APP_PASSWORD is unset (local
// dev, tests), the gate is off.

const COOKIE_NAME = "meal_prep_session";
const SESSION_SECONDS = 90 * 24 * 60 * 60;
const FAILED_LOGIN_DELAY_MS = 1000;

// Paths that stay public: PWA install assets and hashed build assets.
// (/mcp/* is handled before the gate in the worker entry.)
const PUBLIC_PATHS = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
]);

const encoder = new TextEncoder();

async function signingKey(password: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`meal-prep-session-v1:${password}`),
  );
  return crypto.subtle.importKey(
    "raw",
    material,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function signExpiry(password: string, expiry: number): Promise<string> {
  const key = await signingKey(password);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(String(expiry)));
  return base64url(sig);
}

export async function createSessionToken(
  password: string,
  now = Date.now(),
): Promise<string> {
  const expiry = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${expiry}.${await signExpiry(password, expiry)}`;
}

export async function verifySessionToken(
  token: string,
  password: string,
  now = Date.now(),
): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot === -1) return false;

  const expiry = Number(token.slice(0, dot));
  if (!Number.isInteger(expiry) || expiry <= Math.floor(now / 1000)) return false;

  const expected = await signExpiry(password, expiry);
  const given = token.slice(dot + 1);

  // Constant-time comparison.
  if (expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

/** Only same-origin absolute paths are safe redirect targets. */
function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

const escapeAttr = (value: string) =>
  value.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

function loginPage(redirectTo: string, error: string | null, status: number): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meal Prep — Sign in</title>
<style>
:root{color-scheme:light dark}
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#fafaf9;color:#1c1917;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
@media(prefers-color-scheme:dark){body{background:#0c0a09;color:#f5f5f4}}
form{width:100%;max-width:320px;padding:24px;text-align:center}
h1{font-size:20px;font-weight:600;margin:0 0 16px}
input[type=password]{width:100%;box-sizing:border-box;padding:10px 12px;font-size:16px;border:1px solid #d6d3d1;border-radius:10px;background:transparent;color:inherit;margin-bottom:12px}
button{width:100%;padding:10px;font-size:15px;font-weight:500;color:#fff;background:#16a34a;border:0;border-radius:10px;cursor:pointer}
button:hover{background:#15803d}
p.err{color:#dc2626;font-size:14px;margin:0 0 12px}
</style>
</head>
<body>
<form method="post" action="/login">
<h1>🥘 Meal Prep</h1>
${error ? `<p class="err">${error}</p>` : ""}
<input type="hidden" name="redirect" value="${escapeAttr(redirectTo)}">
<input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
<button type="submit">Sign in</button>
</form>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Gate a request. Returns null when the request may proceed, or a Response
 * (login page) to send instead.
 */
export async function requireSession(
  request: Request,
  password: string,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (PUBLIC_PATHS.has(url.pathname) || url.pathname.startsWith("/assets/")) {
    return null;
  }

  const token = getCookie(request, COOKIE_NAME);
  if (token !== null && (await verifySessionToken(token, password))) {
    return null;
  }

  const target = url.pathname === "/login" ? "/" : url.pathname + url.search;
  return loginPage(target, null, 401);
}

/** Handle POST /login: verify the password and set the session cookie. */
export async function handleLogin(
  request: Request,
  password: string,
): Promise<Response> {
  const form = await request.formData();
  const given = form.get("password");
  const redirectTo = safeRedirect(form.get("redirect"));

  if (typeof given !== "string" || given !== password) {
    // Slow down guessing.
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return loginPage(redirectTo, "Wrong password — try again.", 401);
  }

  const token = await createSessionToken(password);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectTo,
      "Set-Cookie": `${COOKIE_NAME}=${token}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
