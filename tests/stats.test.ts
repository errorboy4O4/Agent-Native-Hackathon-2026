import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  histogram, meanBy, numericValues, columnValues, pairedNumeric, parseCsv, pearson, profileCsv, sumBy, topValues,
} from "../shared/stats";

const load = (f: string) => parseCsv(readFileSync(f, "utf8"));

describe("messy csv", () => {
  const p = load("tests/messy.csv");
  const prof = profileCsv(p);
  const col = (n: string) => prof.columnProfiles.find((c) => c.name === n)!;

  it("parses quoted commas, quotes and multiline fields", () => {
    expect(prof.rows).toBe(7);
    expect(p.rows[0][1]).toBe("Smith, Jane");
    expect(p.rows[0][5]).toBe('said "hello"');
    expect(p.rows[6][5]).toBe("multi\nline");
  });
  it("infers types", () => {
    expect(col("id").type).toBe("number");
    expect(col("joined").type).toBe("date");
    expect(col("name").type).toBe("text");
  });
  it("mixed-type column: 'abc' flagged invalid, missing counted", () => {
    expect(col("age").type).toBe("number"); // 5/6 numeric >= 80%
    expect(col("age").invalid).toBe(1); // the stray "abc"
    expect(col("score").type).toBe("number");
    expect(col("score").missing).toBe(2); // "N/A" and ""
    expect(col("notes").missing).toBe(3); // rows 2, 4, 6
  });
  it("numeric summary is exact", () => {
    // 88.5, 92, 75.25, 60, 81 -> mean 79.35, median 81
    const s = col("score").numeric!;
    expect(s).toMatchObject({ min: 60, max: 92, mean: 79.35, median: 81 });
  });
});

describe("stats helpers", () => {
  it("pearson", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNull();
  });
  it("histogram counts sum to n", () => {
    const h = histogram([1, 2, 2, 3, 9, 10], 3);
    expect(h.reduce((s, b) => s + b.count, 0)).toBe(6);
  });
  it("topValues orders by count", () => {
    expect(topValues(["a", "b", "b", "", "c", "b", "a"], 2)).toEqual([
      { value: "b", count: 3 }, { value: "a", count: 2 },
    ]);
  });
});

describe("iris", () => {
  const p = load("public/samples/iris.csv");
  const prof = profileCsv(p);
  it("profiles 150 x 5", () => {
    expect([prof.rows, prof.columns]).toEqual([150, 5]);
    expect(prof.columnProfiles.find((c) => c.name === "species")!.unique).toBe(3);
  });
  it("petal_length/petal_width correlate ~0.96", () => {
    const c = prof.correlations.find((x) => x.a === "petal_length" && x.b === "petal_width")!;
    expect(c.r).toBeGreaterThan(0.95);
    const { xs, ys } = pairedNumeric(p, "petal_length", "petal_width");
    expect(pearson(xs, ys)).toBeCloseTo(c.r, 3);
  });
  it("mean sepal_length 5.8433", () => {
    const m = prof.columnProfiles.find((c) => c.name === "sepal_length")!.numeric!.mean;
    expect(m).toBeCloseTo(5.8433, 3);
  });
});

describe("retail", () => {
  it("sumBy totals match a manual recompute", () => {
    const p = load("public/samples/retail.csv");
    const q = numericValues(columnValues(p, "quantity"));
    expect(q.length).toBe(200);
    const top = sumBy(p, "category", "quantity");
    expect(top.reduce((s, r) => s + r.total, 0)).toBe(q.reduce((s, x) => s + x, 0));
    expect(profileCsv(p).columns).toBe(6);
  });
});

describe("meanBy", () => {
  it("iris petal_length by species matches known means", () => {
    const p = load("public/samples/iris.csv");
    const m = Object.fromEntries(meanBy(p, "species", "petal_length").map((r) => [r.group, r.mean]));
    expect(m).toEqual({ virginica: 5.552, versicolor: 4.26, setosa: 1.462 });
  });
});
