import assert from "node:assert/strict";
import test from "node:test";
import { buildPageHref, escapeLike, getPageCount, getPageOffset, parsePage } from "../src/lib/pagination";

test("pagination membatasi nomor halaman dan menjaga filter pada tautan", () => {
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("-2"), 1);
  assert.equal(parsePage("9999999"), 1);
  assert.equal(getPageOffset(3, 25), 50);
  assert.equal(getPageCount(51, 25), 3);
  assert.equal(buildPageHref("/rooms", { q: "A-01", status: "available" }, 2), "/rooms?q=A-01&status=available&page=2");
  assert.equal(escapeLike("50%_\""), "50\\%\\_\"");
});
