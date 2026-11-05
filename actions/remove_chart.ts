import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { loadUi, saveUi } from "../server/lib/dataset-store";

export default defineAction({
  description: "Remove a chart from the Chart Gallery by id.",
  schema: z.object({ chartId: z.string() }),
  run: async ({ chartId }) => {
    const ui = await loadUi();
    ui.charts = ui.charts.filter((c) => c.id !== chartId);
    await saveUi(ui);
    return { ok: true, remaining: ui.charts.length };
  },
});
