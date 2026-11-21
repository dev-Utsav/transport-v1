import { describe, expect, it } from "vitest";

import { amountInWords, numberToWords } from "@/lib/words";

describe("numberToWords", () => {
  it("uses lakh and crore", () => {
    expect(numberToWords(123456)).toBe("One Lakh Twenty Three Thousand Four Hundred Fifty Six");
    expect(numberToWords(10_000_000)).toBe("One Crore");
    expect(numberToWords(1015)).toBe("One Thousand Fifteen");
    expect(numberToWords(0)).toBe("Zero");
  });
  it("adds paise", () => {
    expect(amountInWords(1255050)).toBe(
      "Rupees Twelve Thousand Five Hundred Fifty and Fifty Paise Only",
    );
    expect(amountInWords(100)).toBe("Rupees One Only");
  });
});
