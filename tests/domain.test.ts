import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInvoicePayment,
  calculateDepositSettlement,
  calculateUtilityAmount,
  parseMeterMilli,
} from "../src/lib/domain";
import { getPasswordStrength, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../src/lib/password";

test("meter membaca hingga tiga desimal tanpa floating point", () => {
  assert.equal(parseMeterMilli("12.3"), 12300n);
  assert.equal(parseMeterMilli("0.001"), 1n);
  assert.equal(parseMeterMilli("123456789012"), null);
  assert.equal(parseMeterMilli("1.0000"), null);
  assert.equal(parseMeterMilli("1e3"), null);
});

test("biaya utilitas membulatkan pecahan rupiah ke atas", () => {
  assert.equal(calculateUtilityAmount("10.25", "11", "200"), 150n);
  assert.equal(calculateUtilityAmount("0", "0.001", "2"), 1n);
  assert.equal(calculateUtilityAmount("5", "4", "100"), null);
  assert.equal(calculateUtilityAmount("1", "2", "-1"), null);
  assert.equal(calculateUtilityAmount("0", "99999999999.999", "99999999999999"), null);
});

test("pembayaran menghitung status sebagian dan lunas serta menolak kelebihan", () => {
  assert.deepEqual(applyInvoicePayment("1000", "0", "400"), { paidAmount: "400", status: "partial" });
  assert.deepEqual(applyInvoicePayment("1000", "400", "600"), { paidAmount: "1000", status: "paid" });
  assert.equal(applyInvoicePayment("1000", "900", "101"), null);
  assert.equal(applyInvoicePayment("1000", "1000", "1"), null);
  assert.equal(applyInvoicePayment("1000", "0", "0"), null);
});

test("penyelesaian deposit memisahkan refund dan potongan", () => {
  assert.deepEqual(calculateDepositSettlement("1500000", "1000000"), {
    refunded: "1000000",
    withheld: "500000",
  });
  assert.deepEqual(calculateDepositSettlement("1500000", "1500000"), {
    refunded: "1500000",
    withheld: "0",
  });
  assert.equal(calculateDepositSettlement("100", "101"), null);
});

test("aturan kekuatan password sesuai panjang minimum dan batas input", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 12);
  assert.equal(getPasswordStrength("short").rules[0].valid, false);
  assert.equal(getPasswordStrength("Abcdefghi12!").rules[0].valid, true);
  assert.equal(getPasswordStrength("Abcdefghi12!").score, 4);
  assert.equal(getPasswordStrength("abcdefghijkl").label, "Lemah");
  assert.equal(getPasswordStrength("Abcdefghijklmn12!").score, 4);
  assert.equal(MAX_PASSWORD_LENGTH, 128);
  assert.equal(MAX_PASSWORD_LENGTH >= MIN_PASSWORD_LENGTH, true);
});
