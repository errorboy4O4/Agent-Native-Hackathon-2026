import { defineAction } from "@agent-native/core/action";
import { readAppState } from "@agent-native/core/application-state";
import { z } from "zod";
import { loadDataset, loadUi, profileOf, renderChart } from "../server/lib/dataset-store";

export default defineAction({
  description:
    "Read the current DataPilot screen: loaded dataset name, its computed profile, every chart (with data) and pinned findings. This is the exact state the user sees.",
  schema: z.object({}),
  http: { method: "GET" },
  readOnly: true,
  run: async () => {
    const raw = await readAppState("dp-dataset");
    if (!raw || typeof raw.csv !== "string") return { loaded: false as const };
    const { name, parsed } = await loadDataset();
    const ui = await loadUi();
    return {
      loaded: true as const,
      name,
      profile: profileOf(parsed),
      charts: ui.charts.map((c) => renderChart(parsed, c)),
      pins: ui.pins,
      summary: ui.summary,
      qa: ui.qa,
    };
  },
});
