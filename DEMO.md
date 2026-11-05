# Clips demo script (about 90 seconds)

Before recording: `pnpm dev`, open http://localhost:8080/datapilot, click "Open a different file" so the intake screen shows. Close other tabs. Keep the Gemini key out of frame (never open `.env` on camera).

| Time | On screen | Say |
|---|---|---|
| 0:00 | Intake screen | "DataPilot. Drop in a CSV, get answers in plain English." |
| 0:08 | Click **Online shop sales** | "No code, no spreadsheet. I'll use a built-in sample." |
| 0:15 | Profile and charts appear | "It reads every row: 200 orders, 6 columns, nothing missing. The charts are drawn by the same actions the agent uses." |
| 0:30 | Change the product chart to **country** with its dropdown | "I stay in control. Re-point any chart, and it updates from the same shared state." |
| 0:42 | Add a scatter: quantity against price | "Two number columns: it reports the correlation, computed in code." |
| 0:52 | Click the suggested question, or type "Which category sells the most units?" | "Now I ask a question." |
| 1:02 | Answer shows with **Where the numbers come from** | "Clothing, 281 units. The model didn't calculate that: it asked for an exact total, and here is the table it used." |
| 1:15 | Click **Pin this answer** | "I can pin it, with its numbers." |
| 1:22 | Show the footer privacy line | "Built with Agent-Native. The model never sees your whole file." |

Optional second take (adds 15 s): load **Messy sign-ups** to show blanks and the "1 value doesn't fit" flag.

Tips: if the model is slow (Gemini free tier can be busy), pre-ask the question once so the answer is already on screen, then ask a second one live. Record in the Clips web app with the browser pane at 1280 px wide.
