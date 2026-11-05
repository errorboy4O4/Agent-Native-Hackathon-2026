import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { loadUi, saveUi } from "../server/lib/dataset-store";

export default defineAction({
  description:
    "Pin a finding (short text plus the source numbers behind it) to the user's Pinned list. Pass `unpinId` instead to remove a pin.",
  schema: z.object({
    text: z.string().max(600).optional(),
    sources: z.array(z.string().max(200)).max(8).default([]).describe("Computed numbers backing the claim, e.g. 'Books: 120 units'"),
    unpinId: z.string().optional(),
  }),
  run: async ({ text, sources, unpinId }) => {
    const ui = await loadUi();
    if (unpinId) ui.pins = ui.pins.filter((p) => p.id !== unpinId);
    else if (text) ui.pins.push({ id: `p${Date.now().toString(36)}`, text, sources });
    await saveUi(ui);
    return { pins: ui.pins };
  },
});
