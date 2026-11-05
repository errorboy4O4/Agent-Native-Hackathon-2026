import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import { loadDataset, loadUi, saveUi } from "../server/lib/dataset-store";
import { answer } from "../server/lib/llm";

export default defineAction({
  description:
    "Answer a plain-English question about the loaded dataset. Numbers come from the computed profile or from exact tool calls (sum_by, mean_by, top_values, column_stats, correlation); the answer lists those `sources`, and any number not found in them is reported in `unverified`. The Q&A appears in the UI.",
  schema: z.object({ question: z.string().min(3).max(500) }),
  run: async ({ question }) => {
    const { name, parsed } = await loadDataset();
    try {
      const r = await answer(parsed, name, question);
      const ui = await loadUi();
      const rec = { id: `a${Date.now().toString(36)}`, question, text: r.text, model: r.model, unverified: r.unverified, sources: r.sources };
      ui.qa = [rec, ...ui.qa].slice(0, 20);
      await saveUi(ui);
      return rec;
    } catch (e: any) {
      fail(e?.message ?? "Could not answer.", { errorCode: "LLM_UNAVAILABLE", statusCode: 503 });
    }
  },
});
