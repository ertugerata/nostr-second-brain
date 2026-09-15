import React from "react";
import { GraphData } from "../utils/graphBuilder";

interface SimpleGraphViewProps {
  graphData: GraphData;
  onSelectNode: (id: string) => void;
}

export const SimpleGraphView: React.FC<SimpleGraphViewProps> = ({ graphData, onSelectNode }) => {
  if (graphData.nodes.length === 0) return null;

  return (
    <div style={{ border: "1px solid #ccc", padding: 15, borderRadius: 6, background: "#fafafa", marginBottom: 20 }}>
      <h4 style={{ margin: "0 0 10px 0" }}>Not Bağlantı Grafiği (Graph View)</h4>
      <svg width="100%" height="220" style={{ border: "1px solid #eee", background: "#fff", borderRadius: 4 }}>
        {graphData.edges.map((edge, idx) => {
          const sourceIdx = graphData.nodes.findIndex((n) => n.id === edge.source);
          const targetIdx = graphData.nodes.findIndex((n) => n.id === edge.target);

          if (sourceIdx === -1 || targetIdx === -1) return null;

          const sAngle = (sourceIdx / graphData.nodes.length) * 2 * Math.PI;
          const tAngle = (targetIdx / graphData.nodes.length) * 2 * Math.PI;

          const sx = 200 + 100 * Math.cos(sAngle);
          const sy = 110 + 70 * Math.sin(sAngle);
          const tx = 200 + 100 * Math.cos(tAngle);
          const ty = 110 + 70 * Math.sin(tAngle);

          return <line key={idx} x1={sx} y1={sy} x2={tx} y2={ty} stroke="#cbd5e1" strokeWidth="2" />;
        })}

        {graphData.nodes.map((node, idx) => {
          const angle = (idx / graphData.nodes.length) * 2 * Math.PI;
          const cx = 200 + 100 * Math.cos(angle);
          const cy = 110 + 70 * Math.sin(angle);

          return (
            <g key={node.id} onClick={() => onSelectNode(node.id)} style={{ cursor: "pointer" }}>
              <circle cx={cx} cy={cy} r="10" fill="#2563eb" />
              <text x={cx + 14} y={cy + 4} fontSize="11" fill="#1e293b" fontWeight="500">
                {node.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};