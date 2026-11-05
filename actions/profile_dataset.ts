import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import { MAX_CSV_CHARS, loadDataset, profileOf, saveDataset } from "../server/lib/dataset-store";
import { parseCsv } from "../shared/stats";

export default defineAction({
  description:
    "Load a CSV (pass `csv` text + `name`) and profile it: row/column counts, per-column type, missing %, numeric summaries (min/max/mean/median/std), top values, and numeric correlations. Omit `csv` to re-read the dataset already loaded. All numbers are computed in code. Loading a new CSV resets charts and pinned findings.",
  schema: z.object({
    name: z.string().default("dataset.csv").describe("File name shown in the UI"),
    csv: z.string().max(MAX_CSV_CHARS).optional().describe("Raw CSV text. Omit to profile the currently loaded dataset."),
  }),
  run: async ({ name, csv }) => {
    if (csv !== undefined) {
      const parsed = parseCsv(csv);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        fail("That file has no data rows. Check it is a CSV with a header row.", { errorCode: "EMPTY_CSV", statusCode: 400 });
      }
      await saveDataset(name, csv);
    }
    const { name: loaded, parsed } = await loadDataset();
    return { name: loaded, profile: profileOf(parsed) };
  },
});
