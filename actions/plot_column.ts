import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import {
  MAX_CHARTS, type ChartSpec, chartKey, colType, loadDataset, loadUi, renderChart, requireColumn, saveUi,
} from "../server/lib/dataset-store";

export default defineAction({
  description:
    "Add a chart for ONE column to the Chart Gallery: histogram for numeric columns, top-10 bar for text/categorical. Pass `chartId` to swap the column of an existing chart instead of adding. Returns the chart's exact data.",
  schema: z.object({
    column: z.string().describe("Exact column name"),
    chartId: z.string().optional().describe("Existing chart to change"),
  }),
  run: async ({ column, chartId }) => {
    const { parsed } = await loadDataset();
    requireColumn(parsed, column);
    const kind = colType(parsed, column) === "number" ? "histogram" : "bar";
    const ui = await loadUi();
    const spec: ChartSpec = { id: chartId ?? `c${Date.now().toString(36)}`, kind, columns: [column] };
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
