// One small call to verify the Gemini key + model. Never prints the key.
import { readFileSync } from "node:fs";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

for (const l of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !(m[1]! in process.env)) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
const google = createGoogleGenerativeAI({ apiKey: key });
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ["gemini-3.8-flash", "gemini-2.5-flash"]) {
  try {
    const t0 = Date.now();
    const r = await generateText({ model: google(id), prompt: "Reply with exactly: pong", maxOutputTokens: 200 });
    console.log(id, "OK", JSON.stringify(r.text.trim()), `${Date.now() - t0}ms`, JSON.stringify(r.usage));
  } catch (e: any) {
    console.log(id, "FAIL", String(e?.message ?? e).split(key).join("[redacted]").slice(0, 300));
  }
}
