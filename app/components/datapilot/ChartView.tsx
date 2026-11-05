import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";

import type { Chart } from "./types";

const BLUE = "#2552d9";
const GRID = "#c9d0da";
const margin = { left: 0, right: 8, top: 4, bottom: 4 };

/** Recharts lives here so it loads only when a chart is first shown. */
export default function ChartView({ chart }: { chart: Chart }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {chart.kind === "scatter" ? (
        <ScatterChart margin={margin}>
          <CartesianGrid stroke={GRID} />
          <XAxis type="number" dataKey="x" name={chart.columns[0] ?? ""} fontSize={12} domain={["auto", "auto"]} />
          <YAxis type="number" dataKey="y" name={chart.columns[1] ?? ""} fontSize={12} domain={["auto", "auto"]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={chart.data} fill={BLUE} fillOpacity={0.65} isAnimationActive={false} />
        </ScatterChart>
      ) : (
        <BarChart data={chart.data} margin={margin}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" fontSize={12} interval={0} angle={-25} textAnchor="end" height={56} />
          <YAxis fontSize={12} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill={BLUE} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
