import test from "node:test";
import assert from "node:assert/strict";
import { formatDateParam, joinUrl, trimSafe } from "../dist/index.js";

test("formatDateParam formats Date instances correctly", () => {
  const d = new Date(2026, 9, 24); // October 24, 2026 (month is 0-indexed: 9 = Oct)
  assert.equal(formatDateParam(d), "20261024");
});

test("formatDateParam handles YYYYMMDD string without modification", () => {
  assert.equal(formatDateParam("20261024"), "20261024");
  assert.equal(formatDateParam("  20261024  "), "20261024");
});

test("formatDateParam converts YYYY-MM-DD strings to YYYYMMDD", () => {
  assert.equal(formatDateParam("2026-10-24"), "20261024");
  assert.equal(formatDateParam("2026-9-5"), "20260905");
});

test("formatDateParam converts numeric timestamps", () => {
  const ts = new Date(2026, 0, 15).getTime();
  assert.equal(formatDateParam(ts), "20260115");
});

test("formatDateParam throws on invalid formats", () => {
  assert.throws(() => formatDateParam("not-a-date"), /Invalid date format/);
  assert.throws(() => formatDateParam(new Date("invalid")), /Invalid Date object/);
  assert.throws(() => formatDateParam(null), /Unsupported date type/);
});

test("joinUrl correctly combines base URLs and endpoints without duplicate slashes", () => {
  assert.equal(
    joinUrl("https://web.spaggiari.eu/rest/w1/", "/students/", "/12345678/grades26/"),
    "https://web.spaggiari.eu/rest/w1/students/12345678/grades26"
  );
  assert.equal(
    joinUrl("https://web.spaggiari.eu/rest/w1", "misc/whoami"),
    "https://web.spaggiari.eu/rest/w1/misc/whoami"
  );
});

test("trimSafe safely trims strings or returns empty string", () => {
  assert.equal(trimSafe("  ISTITUTO SUPERIORE   "), "ISTITUTO SUPERIORE");
  assert.equal(trimSafe(null), "");
  assert.equal(trimSafe(undefined), "");
});
