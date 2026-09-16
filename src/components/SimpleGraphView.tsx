import React, { useState } from "react";
import { GraphData } from "../utils/graphBuilder";

interface SimpleGraphViewProps {
  graphData: GraphData;
  onSelectNode: (id: string) => void;
}

export const SimpleGraphView: React.FC<SimpleGraphViewProps> = ({ graphData, onSelectNode }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  if (graphData.nodes.length === 0) return null;

  const nodeCount = graphData.nodes.length;
  const width = 700;
  const height = 450;
  const cx = width / 2;
  const cy = height / 2;
  const rx = Math.min(width, height) * 0.38;
  const ry = Math.min(width, height) * 0.38;

  const connectedNodeIds = new Set<string>();
  graphData.edges.forEach((e) => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });

  return (
    <div style={{ border: "1px solid #e2e8f0", padding: 20, borderRadius: 8, background: "#ffffff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
          Not Bağlantı Grafiği ({nodeCount} Düğüm, {graphData.edges.length} Bağlantı)
        </h3>
        {hoveredNode && (
          <span style={{ fontSize: 13, color: "#2563eb", fontWeight: 500 }}>
            Seçili: {graphData.nodes.find((n) => n.id === hoveredNode)?.title}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", maxHeight: 450, border: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: 6 }}
      >
        {graphData.edges.map((edge, idx) => {
          const sourceIdx = graphData.nodes.findIndex((n) => n.id === edge.source);
          const targetIdx = graphData.nodes.findIndex((n) => n.id === edge.target);

          if (sourceIdx === -1 || targetIdx === -1) return null;

          const sAngle = (sourceIdx / nodeCount) * 2 * Math.PI;
          const tAngle = (targetIdx / nodeCount) * 2 * Math.PI;

          const sx = cx + rx * Math.cos(sAngle);
          const sy = cy + ry * Math.sin(sAngle);
          const tx = cx + rx * Math.cos(tAngle);
          const ty = cy + ry * Math.sin(tAngle);

          const isHighlighted = edge.source === hoveredNode || edge.target === hoveredNode;

          return (
            <line
              key={idx}
              x1={sx}
              y1={sy}
              x2={tx}
              y2={ty}
              stroke={isHighlighted ? "#2563eb" : "#cbd5e1"}
              strokeWidth={isHighlighted ? "2.5" : "1.5"}
              strokeOpacity={isHighlighted ? 1 : 0.6}
            />
          );
        })}

        {graphData.nodes.map((node, idx) => {
          const angle = (idx / nodeCount) * 2 * Math.PI;
          const nx = cx + rx * Math.cos(angle);
          const ny = cy + ry * Math.sin(angle);

          const isConnected = connectedNodeIds.has(node.id);
          const isHovered = hoveredNode === node.id;
          const isHoveredNeighbor =
            hoveredNode !== null &&
            graphData.edges.some(
              (e) =>
                (e.source === hoveredNode && e.target === node.id) ||
                (e.target === hoveredNode && e.source === node.id)
            );

          const showText = nodeCount <= 25 || isHovered || isHoveredNeighbor;

          return (
            <g
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: "pointer" }}
            >
              <title>{node.title}</title>
              <circle
                cx={nx}
                cy={ny}
                r={isHovered ? 8 : isConnected ? 6 : 4}
                fill={isHovered ? "#1d4ed8" : isConnected ? "#2563eb" : "#94a3b8"}
                stroke="#fff"
                strokeWidth="1.5"
              />
              {showText && (
                <text
                  x={nx + (Math.cos(angle) >= 0 ? 10 : -10)}
                  y={ny + 4}
                  textAnchor={Math.cos(angle) >= 0 ? "start" : "end"}
                  fontSize={isHovered ? "12" : "10"}
                  fill={isHovered ? "#1d4ed8" : "#334155"}
                  fontWeight={isHovered || isConnected ? "600" : "400"}
                >
                  {node.title.length > 20 ? node.title.slice(0, 18) + "…" : node.title}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};