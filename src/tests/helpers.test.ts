import {
  generateReference,
  hashObject
} from "../../src/utils/helpers";

describe("Utility Helpers", () => {
  // ── generateReference ──────────────────────────────────────────────────────

  describe("generateReference", () => {
    it("should generate a reference with the given prefix", () => {
      const ref = generateReference("FUND");
      expect(ref).toMatch(/^FUND-/);
    });

    it("should generate unique references on each call", () => {
      const ref1 = generateReference("TXF");
      const ref2 = generateReference("TXF");
      expect(ref1).not.toBe(ref2);
    });

    it("should return a non-empty string", () => {
      const ref = generateReference("WDR");
      expect(ref.length).toBeGreaterThan(0);
    });
  });

  // ── hashObject ─────────────────────────────────────────────────────────────

  describe("hashObject", () => {
    it("should return the same hash for the same object", () => {
      const obj = { amount: 5000, email: "test@example.com" };
      expect(hashObject(obj)).toBe(hashObject(obj));
    });

    it("should return different hashes for different objects", () => {
      expect(hashObject({ a: 1 })).not.toBe(hashObject({ a: 2 }));
    });

    it("should return a 64-character hex string (SHA-256)", () => {
      const hash = hashObject({ test: true });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

});
