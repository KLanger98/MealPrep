import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  handleLogin,
  requireSession,
  verifySessionToken,
} from "../../app/lib/auth";

const PASSWORD = "correct-horse";

function loginRequest(body: Record<string, string>) {
  return new Request("https://app.test/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

function pageRequest(path: string, cookie?: string) {
  return new Request(`https://app.test${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

describe("session tokens", () => {
  it("round-trips a valid token", async () => {
    const token = await createSessionToken(PASSWORD);
    expect(await verifySessionToken(token, PASSWORD)).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(PASSWORD);
    const [expiry, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(expiry) + 9999}.${sig}`, PASSWORD)).toBe(false);
    expect(await verifySessionToken(`${expiry}.AAAA${sig.slice(4)}`, PASSWORD)).toBe(false);
  });

  it("rejects a token signed with a different password", async () => {
    const token = await createSessionToken("other-password");
    expect(await verifySessionToken(token, PASSWORD)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken(PASSWORD, Date.now() - 91 * 24 * 60 * 60 * 1000);
    expect(await verifySessionToken(token, PASSWORD)).toBe(false);
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken("", PASSWORD)).toBe(false);
    expect(await verifySessionToken("no-dot", PASSWORD)).toBe(false);
    expect(await verifySessionToken("123.", PASSWORD)).toBe(false);
  });
});

describe("requireSession", () => {
  it("serves the login page without a session", async () => {
    const response = await requireSession(pageRequest("/recipes"), PASSWORD);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(401);
    const html = await response!.text();
    expect(html).toContain('action="/login"');
    expect(html).toContain('value="/recipes"');
  });

  it("lets a valid session through", async () => {
    const token = await createSessionToken(PASSWORD);
    const response = await requireSession(
      pageRequest("/recipes", `meal_prep_session=${token}`),
      PASSWORD,
    );
    expect(response).toBeNull();
  });

  it("keeps PWA install assets public", async () => {
    for (const path of ["/manifest.webmanifest", "/apple-touch-icon.png", "/icon-512.png", "/favicon.ico", "/assets/entry.client-abc.js"]) {
      expect(await requireSession(pageRequest(path), PASSWORD)).toBeNull();
    }
  });

  it("escapes the redirect target in the login form", async () => {
    const response = await requireSession(
      pageRequest('/recipes?q="><script>alert(1)</script>'),
      PASSWORD,
    );
    const html = await response!.text();
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("handleLogin", () => {
  it("sets a session cookie and redirects on the right password", async () => {
    const response = await handleLogin(
      loginRequest({ password: PASSWORD, redirect: "/calendar" }),
      PASSWORD,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/calendar");

    const cookie = response.headers.get("Set-Cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");

    const token = cookie.match(/meal_prep_session=([^;]+)/)![1];
    expect(await verifySessionToken(token, PASSWORD)).toBe(true);
  });

  it("rejects a wrong password without a cookie", async () => {
    const response = await handleLogin(
      loginRequest({ password: "nope", redirect: "/" }),
      PASSWORD,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await response.text()).toContain("Wrong password");
  }, 10_000);

  it("ignores off-site redirect targets", async () => {
    const response = await handleLogin(
      loginRequest({ password: PASSWORD, redirect: "https://evil.example" }),
      PASSWORD,
    );
    expect(response.headers.get("Location")).toBe("/");

    const protocolRelative = await handleLogin(
      loginRequest({ password: PASSWORD, redirect: "//evil.example" }),
      PASSWORD,
    );
    expect(protocolRelative.headers.get("Location")).toBe("/");
  });
});
