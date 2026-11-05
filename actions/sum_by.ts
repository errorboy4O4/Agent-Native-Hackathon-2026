import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { colType, loadDataset, requireColumn } from "../server/lib/dataset-store";
import { sumBy } from "../shared/stats";

export default defineAction({
  description:
    "Exact totals: sum a NUMERIC column grouped by a categorical column, sorted high to low (top `limit`). Use this for questions like 'which category sells the most?'. Computed in code over every row.",
  schema: z.object({
    group: z.string().describe("Column to group by"),
    value: z.string().describe("Numeric column to sum"),
    limit: z.number().int().min(1).max(50).default(10),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ group, value, limit }) => {
    const { parsed } = await loadDataset();
    requireColumn(parsed, group);
    requireColumn(parsed, value);
    if (colType(parsed, value) !== "number") throw new Error(`"${value}" is not numeric.`);
    return { group, value, rows: sumBy(parsed, group, value, limit) };
  },
});
