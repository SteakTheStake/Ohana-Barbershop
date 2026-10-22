import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import testing from "next/experimental/testing/server";
import { createDemoSession, DEMO_COOKIE, DEMO_SECONDS } from "../src/lib/demo";
import { config, proxy } from "../src/proxy";

const { unstable_doesMiddlewareMatch } = testing;

test("the demo password protects the entire site and both hostnames", () => {
  const saved = { ...process.env };
  try {
    process.env.DEMO_MODE = "true";
    process.env.PAYLOAD_SECRET = "test-only-secret-with-at-least-thirty-two-characters";
    for (const host of ["summitmc.xyz", "owner.summitmc.xyz"]) {
      for (const path of [
        "/", "/about", "/services", "/shop", "/contact", "/book", "/account",
        "/owner", "/admin/collections/users", "/large-logo.png", "/favicon.ico",
        "/sitemap.xml", "/_next/image?url=%2Flarge-logo.png&w=640&q=75",
      ]) {
        assert.equal(unstable_doesMiddlewareMatch({ config, url: `https://${host}${path}` }), true);
        const unauthenticatedHeaders: HeadersInit[] = [
          {},
          { rsc: "1", "next-router-prefetch": "1" },
          { cookie: `${DEMO_COOKIE}=forged` },
          { cookie: `${DEMO_COOKIE}=${createDemoSession(Date.now() - DEMO_SECONDS * 1000)}` },
        ];
        for (const headers of unauthenticatedHeaders) {
          const response = proxy(new NextRequest(`https://${host}${path}`, { headers }));
          assert.equal(response.status, 307, `${host}${path}`);
          const destination = new URL(response.headers.get("location")!);
          assert.equal(destination.origin, `https://${host}`);
          assert.equal(destination.pathname, "/demo");
          assert.equal(destination.searchParams.get("next"), path);
          assert.match(response.headers.get("cache-control")!, /no-store/);
          assert.equal(response.headers.get("vary"), "Cookie");
        }
      }
      for (const path of ["/api", "/api/owner/session", "/api/ohana/catalog", "/api/graphql", "/api/users"]) {
        assert.equal(unstable_doesMiddlewareMatch({ config, url: path }), true);
        for (const method of ["GET", "POST", "OPTIONS"]) {
          assert.equal(proxy(new NextRequest(`https://${host}${path}`, { method })).status, 401);
        }
      }
      const cookie = `${DEMO_COOKIE}=${createDemoSession()}`;
      for (const path of ["/", "/shop", "/owner", "/api/owner/session"]) {
        assert.equal(proxy(new NextRequest(`https://${host}${path}`, { headers: { cookie } })).status, 200);
      }
      for (const path of ["/demo", "/api/demo", "/api/demo/logout", "/api/health", "/_next/static/test.css"]) {
        assert.equal(proxy(new NextRequest(`https://${host}${path}`)).status, 200);
      }
    }
    process.env.DEMO_MODE = "false";
    assert.equal(proxy(new NextRequest("https://summitmc.xyz/")).status, 200);
    assert.equal(proxy(new NextRequest("https://owner.summitmc.xyz/api/owner/session")).status, 200);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
