// Generates public/samples/retail.csv — synthetic, seeded, deterministic. Run: pnpm tsx scripts/gen-retail.ts
import { writeFileSync } from "node:fs";

let s = 12345;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;

const catalog: Record<string, [string, number][]> = {
  Electronics: [["Headphones", 59.99], ["USB Cable", 9.99], ["Webcam", 44.5], ["Speaker", 79]],
  Clothing: [["T-Shirt", 18], ["Jeans", 52], ["Jacket", 96.5], ["Socks", 6.25]],
  Home: [["Desk Lamp", 27.9], ["Mug", 8.5], ["Cushion", 21], ["Plant Pot", 14.75]],
  Books: [["Novel", 12.99], ["Cookbook", 24], ["Notebook", 5.5]],
};
const weights: [string, number][] = [["Electronics", 0.3], ["Clothing", 0.35], ["Home", 0.2], ["Books", 0.15]];
const countries = ["United Kingdom", "Germany", "France", "India", "United States", "Spain"];

const lines = ["date,product,category,quantity,price,country"];
for (let i = 0; i < 200; i++) {
  let r = rnd(), cat = "Books";
  for (const [c, w] of weights) { if (r < w) { cat = c; break; } r -= w; }
  const [product, base] = pick(catalog[cat]!);
  const day = 1 + Math.floor(rnd() * 90);
  const d = new Date(Date.UTC(2026, 0, day));
  const qty = 1 + Math.floor(rnd() * (cat === "Electronics" ? 3 : 6));
  const price = Math.round(base * (0.9 + rnd() * 0.2) * 100) / 100;
  lines.push([d.toISOString().slice(0, 10), product, cat, qty, price.toFixed(2), pick(countries)].join(","));
}
writeFileSync("public/samples/retail.csv", lines.join("\n") + "\n");
console.log("rows:", lines.length - 1);
