import assert from "node:assert/strict";
import test from "node:test";
import { hasLeaseConflictAtMoveIn } from "../src/lib/rental-applications";

test("permohonan bentrok jika kontrak aktif masih berlaku pada tanggal masuk", () => {
  assert.equal(hasLeaseConflictAtMoveIn("2026-12-01", ["2026-12-01"]), true);
  assert.equal(hasLeaseConflictAtMoveIn("2026-12-01", [null]), true);
  assert.equal(hasLeaseConflictAtMoveIn("2026-12-01", ["2027-01-01"]), true);
});

test("permohonan boleh masuk setelah kontrak aktif selesai", () => {
  assert.equal(hasLeaseConflictAtMoveIn("2026-12-02", ["2026-12-01"]), false);
  assert.equal(hasLeaseConflictAtMoveIn("2026-12-01", []), false);
});
