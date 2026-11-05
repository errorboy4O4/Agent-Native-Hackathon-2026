import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import {
  MAX_CHARTS, type ChartSpec, chartKey, colType, loadDataset, loadUi, renderChart, requireColumn, saveUi,
} from "../server/lib/dataset-store";

export default defineAction({
  description:
    "Add a scatter chart for two NUMERIC columns with their Pearson correlation. Pass `chartId` to change the columns of an existing scatter. Returns exact points (sampled to 500) and r.",
  schema: z.object({
    x: z.string().describe("Numeric column for the x axis"),
    y: z.string().describe("Numeric column for the y axis"),
    chartId: z.string().optional(),
  }),
  run: async ({ x, y, chartId }) => {
    const { parsed } = await loadDataset();
    for (const c of [x, y]) {
      requireColumn(parsed, c);
      if (colType(parsed, c) !== "number") fail(`"${c}" is not numeric, so it can't be used in a scatter.`, { errorCode: "NOT_NUMERIC", statusCode: 400 });
    }
    const ui = await loadUi();
    const spec: ChartSpec = { id: chartId ?? `c${Date.now().toString(36)}`, kind: "scatter", columns: [x, y] };
    const idx = ui.charts.findIndex((c) => c.id === chartId);
    if (chartId && idx < 0) fail(`No chart with id ${chartId}`, { errorCode: "NOT_FOUND", statusCode: 404 });
    if (idx >= 0) ui.charts[idx] = spec;
    else {
      const dup = ui.charts.find((c) => chartKey(c) === chartKey(spec));
      if (dup) return renderChart(parsed, dup);
      if (ui.charts.length >= MAX_CHARTS) fail(`Chart limit (${MAX_CHARTS}) reached; remove one first.`, { errorCode: "LIMIT", statusCode: 400 });
      ui.charts.push(spec);
    }
    await saveUi(ui);
    return renderChart(parsed, spec);
  },
});
