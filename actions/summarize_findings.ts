import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import { loadDataset, loadUi, saveUi } from "../server/lib/dataset-store";
import { summarize } from "../server/lib/llm";

export default defineAction({
  description:
    "Write a short plain-English summary of the loaded dataset. The model narrates computed numbers only; any number it states is checked against the profile and tool results, and unverified ones are reported in `unverified`. The summary appears in the UI.",
  schema: z.object({}),
  run: async () => {
    const { name, parsed } = await loadDataset();
    try {
      const r = await summarize(parsed, name);
      const ui = await loadUi();
      ui.summary = { id: `s${Date.now().toString(36)}`, text: r.text, model: r.model, unverified: r.unverified, sources: r.sources };
      await saveUi(ui);
      return ui.summary;
    } catch (e: any) {
      fail(e?.message ?? "Summary failed.", { errorCode: "LLM_UNAVAILABLE", statusCode: 503 });
    }
  },
});
