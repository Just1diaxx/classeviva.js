import test from "node:test";
import assert from "node:assert/strict";
import { CookieJar } from "../dist/index.js";

test("CookieJar stores and retrieves cookies", () => {
  const jar = new CookieJar();
  jar.set("PHPSESSID", "sess12345");
  jar.set("webidentity", "S12345678C");

  assert.equal(jar.get("PHPSESSID"), "sess12345");
  assert.equal(jar.getSessionId(), "sess12345");
  assert.equal(jar.getWebIdentity(), "S12345678C");
  assert.equal(jar.hasAuthCookies(), true);

  assert.equal(jar.toCookieHeader(), "PHPSESSID=sess12345; webidentity=S12345678C");
});

test("CookieJar parses Set-Cookie header strings", () => {
  const jar = new CookieJar();
  jar.parseSetCookieString("PHPSESSID=abcdef123; path=/; HttpOnly; Secure; SameSite=Lax");
  jar.parseSetCookieString("webrole=gen; path=/");

  assert.equal(jar.get("PHPSESSID"), "abcdef123");
  assert.equal(jar.get("webrole"), "gen");
});

test("CookieJar collects from fetch Response headers", () => {
  const jar = new CookieJar();
  const headers = new Headers();
  headers.append("set-cookie", "PHPSESSID=token999; path=/");
  headers.append("set-cookie", "i18n_redirected=it; path=/");

  const mockResponse = new Response("{}", { headers });
  jar.collectFromResponse(mockResponse);

  assert.equal(jar.get("PHPSESSID"), "token999");
  assert.equal(jar.get("i18n_redirected"), "it");
});

test("CookieJar can be cleared", () => {
  const jar = new CookieJar({ PHPSESSID: "abc" });
  assert.equal(jar.hasAuthCookies(), true);
  jar.clear();
  assert.equal(jar.hasAuthCookies(), false);
  assert.equal(jar.getSessionId(), undefined);
});
