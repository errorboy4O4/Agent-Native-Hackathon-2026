import { describe, expect, it } from "vitest";
import { findUnverifiedNumbers } from "../shared/verify";

const ctx = [JSON.stringify({ rows: 200, mean: 31.1924, Clothing: 79, total: 1234.5 })];

describe("findUnverifiedNumbers", () => {
  it("accepts exact, comma-formatted and rounded numbers", () => {
    expect(findUnverifiedNumbers("200 rows, mean 31.19, Clothing 79, total 1,234.5", ctx)).toEqual([]);
  });
  it("flags invented numbers", () => {
    expect(findUnverifiedNumbers("Clothing sold 85 units", ctx)).toEqual(["85"]);
  });
  it("flags derived percentages", () => {
    expect(findUnverifiedNumbers("that is 39.5% of rows", ctx)).toEqual(["39.5"]);
  });
  it("ignores small whole numbers", () => {
    expect(findUnverifiedNumbers("the top 3 categories", ctx)).toEqual([]);
  });
});
