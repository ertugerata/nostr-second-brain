import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { GraphData, GraphNode, GraphLink } from "../utils/graphBuilder";

interface SimpleGraphViewProps {
  graphData: GraphData;
  onSelectNode: (id: string) => void;
  theme?: "light" | "dark";
}

export const SimpleGraphView: React.FC<SimpleGraphViewProps> = ({
  graphData,
  onSelectNode,
  theme = "light",
}) => {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 550 });

  // Handle Container Resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: clientWidth || 800,
          height: Math.max(clientHeight, 500) || 550,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", updateDimensions);
      observer.disconnect();
    };
  }, []);

  // Theme colors
  const isDark = theme === "dark";
  const colors = useMemo(() => {
    return {
      bg: isDark ? "#0f172a" : "#f8fafc",
      cardBg: isDark ? "#1e293b" : "#ffffff",
      text: isDark ? "#f8fafc" : "#0f172a",
      textMuted: isDark ? "#94a3b8" : "#64748b",
      border: isDark ? "#334155" : "#e2e8f0",
      nodeNormal: isDark ? "#38bdf8" : "#2563eb",
      nodeUncreated: isDark ? "#f59e0b" : "#d97706",
      nodeHover: isDark ? "#f43f5e" : "#e11d48",
      nodeSelected: isDark ? "#a855f7" : "#7c3aed",
      nodeDimmed: isDark ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.5)",
      linkNormal: isDark ? "#475569" : "#cbd5e1",
      linkHighlight: isDark ? "#38bdf8" : "#2563eb",
      linkDimmed: isDark ? "rgba(30, 41, 59, 0.2)" : "rgba(241, 245, 249, 0.3)",
      particle: isDark ? "#38bdf8" : "#2563eb",
    };
  }, [isDark]);

  // Clone & prepare data for force graph to prevent direct mutation issues
  const preparedData = useMemo(() => {
    const rawLinks = graphData.links || graphData.edges || [];
    const nodes: GraphNode[] = (graphData.nodes || []).map((n) => ({ ...n }));
    const links = rawLinks.map((l) => ({
      source: typeof l.source === "object" ? (l.source as any).id : l.source,
      target: typeof l.target === "object" ? (l.target as any).id : l.target,
    }));
    return { nodes, links };
  }, [graphData]);

  // Set of connected nodes & links relative to hoverNode or selectedNode
  const { highlightNodes, highlightLinks } = useMemo(() => {
    const hNodes = new Set<string>();
    const hLinks = new Set<GraphLink>();

    const activeNode = hoverNode || (selectedNodeId ? preparedData.nodes.find((n) => n.id === selectedNodeId) : null);

    if (activeNode) {
      hNodes.add(activeNode.id);
      preparedData.links.forEach((link: any) => {
        const sourceId = typeof link.source === "object" ? link.source.id : link.source;
        const targetId = typeof link.target === "object" ? link.target.id : link.target;

        if (sourceId === activeNode.id || targetId === activeNode.id) {
          hLinks.add(link);
          hNodes.add(sourceId);
          hNodes.add(targetId);
        }
      });
    }

    return { highlightNodes: hNodes, highlightLinks: hLinks };
  }, [hoverNode, selectedNodeId, preparedData]);

  // Search filter matching
  const matchingNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return undefined;
    const query = searchQuery.toLowerCase();
    const matches = new Set<string>();
    preparedData.nodes.forEach((n) => {
      if (n.title.toLowerCase().includes(query) || n.id.toLowerCase().includes(query)) {
        matches.add(n.id);
      }
    });
    return matches;
  }, [searchQuery, preparedData]);

  // Zoom controls
  const handleZoomIn = () => {
    if (fgRef.current) {
      if (viewMode === "2d") {
        fgRef.current.zoom(fgRef.current.zoom() * 1.3, 400);
      } else {
        const cam = fgRef.current.camera();
        if (cam) {
          fgRef.current.cameraPosition({ x: cam.position.x * 0.7, y: cam.position.y * 0.7, z: cam.position.z * 0.7 }, undefined, 400);
        }
      }
    }
  };

  const handleZoomOut = () => {
    if (fgRef.current) {
      if (viewMode === "2d") {
        fgRef.current.zoom(fgRef.current.zoom() / 1.3, 400);
      } else {
        const cam = fgRef.current.camera();
        if (cam) {
          fgRef.current.cameraPosition({ x: cam.position.x * 1.3, y: cam.position.y * 1.3, z: cam.position.z * 1.3 }, undefined, 400);
        }
      }
    }
  };

  const handleZoomToFit = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  // Node Click handler
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNodeId(node.id);
      if (fgRef.current && viewMode === "2d") {
        fgRef.current.centerAt(node.x, node.y, 400);
        fgRef.current.zoom(2.5, 400);
      } else if (fgRef.current && viewMode === "3d" && node.x !== undefined && node.y !== undefined && node.z !== undefined) {
        const dist = 80;
        const distRatio = 1 + dist / Math.hypot(node.x, node.y, node.z);
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          { x: node.x, y: node.y, z: node.z },
          1000
        );
      }
      onSelectNode(node.id);
    },
    [onSelectNode, viewMode]
  );

  // 2D Canvas Custom Node Drawing
  const drawNode2D = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isHovered = hoverNode && hoverNode.id === node.id;
      const isSelected = selectedNodeId === node.id;
      const isHighlighted = highlightNodes.has(node.id);
      const isMatch = matchingNodeIds ? matchingNodeIds.has(node.id) : true;
      const isDimmed = (highlightNodes.size > 0 && !isHighlighted) || (matchingNodeIds && !isMatch);

      const r = Math.max(3, Math.min((node.val || 3) * 0.8, 12));
      const fontSize = Math.max(10 / globalScale, 3);

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.2 : 1;

      // Draw outer glow if hovered / selected
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4 / globalScale, 0, 2 * Math.PI, false);
        ctx.fillStyle = isSelected ? colors.nodeSelected : colors.nodeHover;
        ctx.fill();
      }

      // Draw main circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);

      if (node.uncreated) {
        ctx.fillStyle = colors.nodeUncreated;
        ctx.strokeStyle = isDark ? "#ffffff" : "#000000";
        ctx.setLineDash([2, 2]);
        ctx.stroke();
      } else if (isSelected) {
        ctx.fillStyle = colors.nodeSelected;
      } else if (isHovered) {
        ctx.fillStyle = colors.nodeHover;
      } else if (isHighlighted) {
        ctx.fillStyle = colors.nodeNormal;
      } else {
        ctx.fillStyle = colors.nodeNormal;
      }

      ctx.fill();

      // Border around node
      ctx.setLineDash([]);
      ctx.lineWidth = 1 / globalScale;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.2)";
      ctx.stroke();

      // Draw text label
      const showLabel = globalScale > 1.2 || isHovered || isSelected || isHighlighted || (matchingNodeIds && isMatch);
      if (showLabel) {
        const label = node.title || node.id;
        ctx.font = `${isHovered || isSelected ? "bold " : ""}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textY = node.y + r + fontSize + 2 / globalScale;

        // Label background pill for readability
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.75)" : "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(
          node.x - textWidth / 2 - 2 / globalScale,
          textY - fontSize / 2 - 1 / globalScale,
          textWidth + 4 / globalScale,
          fontSize + 2 / globalScale
        );

        ctx.fillStyle = isSelected
          ? colors.nodeSelected
          : isHovered
          ? colors.nodeHover
          : isMatch && matchingNodeIds
          ? colors.nodeHover
          : colors.text;
        ctx.fillText(label, node.x, textY);
      }

      ctx.restore();
    },
    [hoverNode, selectedNodeId, highlightNodes, matchingNodeIds, colors, isDark]
  );

  // 3D Custom Node Object Generator
  const nodeThreeObject3D = useCallback(
    (node: any) => {
      const isHovered = hoverNode && hoverNode.id === node.id;
      const isSelected = selectedNodeId === node.id;
      const isHighlighted = highlightNodes.has(node.id);
      const isMatch = matchingNodeIds ? matchingNodeIds.has(node.id) : true;
      const isDimmed = (highlightNodes.size > 0 && !isHighlighted) || (matchingNodeIds && !isMatch);

      const radius = Math.max(2, Math.min((node.val || 3) * 0.6, 8));

      let colorHex = colors.nodeNormal;
      if (node.uncreated) colorHex = colors.nodeUncreated;
      if (isSelected) colorHex = colors.nodeSelected;
      else if (isHovered) colorHex = colors.nodeHover;

      const group = new THREE.Group();

      // Node Sphere Mesh
      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(colorHex),
        transparent: isDimmed,
        opacity: isDimmed ? 0.25 : 0.9,
        shininess: 80,
      });
      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);

      // Text Sprite Label
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const text = node.title || node.id;
        ctx.font = "Bold 24px -apple-system, BlinkMacSystemFont, sans-serif";
        const textWidth = ctx.measureText(text).width;
        canvas.width = Math.max(textWidth + 16, 64);
        canvas.height = 40;

        ctx.font = "Bold 24px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = isDark ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = isDark ? "#ffffff" : "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: isDimmed ? 0.2 : 0.95,
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(0, radius + 6, 0);
        sprite.scale.set(canvas.width / 4, canvas.height / 4, 1);
        group.add(sprite);
      }

      return group;
    },
    [hoverNode, selectedNodeId, highlightNodes, matchingNodeIds, colors, isDark]
  );

  // Link styling getters
  const getLinkColor = useCallback(
    (link: any) => {
      const isHighlighted = highlightLinks.has(link);
      if (highlightNodes.size > 0 && !isHighlighted) {
        return colors.linkDimmed;
      }
      return isHighlighted ? colors.linkHighlight : colors.linkNormal;
    },
    [highlightLinks, highlightNodes, colors]
  );

  const getLinkWidth = useCallback(
    (link: any) => {
      return highlightLinks.has(link) ? 2.5 : 1;
    },
    [highlightLinks]
  );

  const getLinkDirectionalParticles = useCallback(
    (link: any) => {
      return highlightLinks.has(link) ? 4 : 0;
    },
    [highlightLinks]
  );

  if (!graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: colors.textMuted }}>
        Ağ haritası oluşturmak için en az bir not veya <code>[[wikilink]]</code> ekleyin.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.cardBg,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Control Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.cardBg,
          zIndex: 10,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.text }}>
            🕸️ İnteraktif Ağ Haritası
          </h3>
          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 12,
              backgroundColor: isDark ? "#334155" : "#e2e8f0",
              color: colors.textMuted,
              fontWeight: 600,
            }}
          >
            {preparedData.nodes.length} Düğüm • {preparedData.links.length} Bağlantı
          </span>
        </div>

        {/* Search & Mode Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            placeholder="Ağda not ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "5px 10px",
              fontSize: 12,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bg,
              color: colors.text,
              outline: "none",
              width: 140,
            }}
          />

          {/* 2D / 3D Mode Toggle */}
          <div
            style={{
              display: "inline-flex",
              border: `1px solid ${colors.border}`,
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setViewMode("2d")}
              style={{
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                backgroundColor: viewMode === "2d" ? colors.nodeNormal : "transparent",
                color: viewMode === "2d" ? "#ffffff" : colors.textMuted,
                cursor: "pointer",
              }}
            >
              2D
            </button>
            <button
              onClick={() => setViewMode("3d")}
              style={{
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                backgroundColor: viewMode === "3d" ? colors.nodeNormal : "transparent",
                color: viewMode === "3d" ? "#ffffff" : colors.textMuted,
                cursor: "pointer",
              }}
            >
              3D
            </button>
          </div>

          {/* Zoom Buttons */}
          <button
            onClick={handleZoomIn}
            title="Yakınlaştır"
            style={{
              padding: "4px 8px",
              fontSize: 14,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bg,
              color: colors.text,
              cursor: "pointer",
            }}
          >
            ➕
          </button>
          <button
            onClick={handleZoomOut}
            title="Uzaklaştır"
            style={{
              padding: "4px 8px",
              fontSize: 14,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bg,
              color: colors.text,
              cursor: "pointer",
            }}
          >
            ➖
          </button>
          <button
            onClick={handleZoomToFit}
            title="Sığdır"
            style={{
              padding: "4px 8px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bg,
              color: colors.text,
              cursor: "pointer",
            }}
          >
            🔍 Sığdır
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, width: "100%", height: dimensions.height - 50, position: "relative" }}>
        {viewMode === "2d" ? (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height - 50}
            graphData={preparedData}
            backgroundColor={colors.bg}
            nodeCanvasObject={drawNode2D}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, Math.max(6, (node.val || 3)), 0, 2 * Math.PI, false);
              ctx.fill();
            }}
            onNodeHover={(node: any) => setHoverNode(node || null)}
            onNodeClick={handleNodeClick}
            linkColor={getLinkColor}
            linkWidth={getLinkWidth}
            linkDirectionalParticles={getLinkDirectionalParticles}
            linkDirectionalParticleWidth={3}
            linkDirectionalParticleSpeed={0.008}
            linkDirectionalParticleColor={() => colors.particle}
            d3VelocityDecay={0.3}
            cooldownTicks={100}
          />
        ) : (
          <ForceGraph3D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height - 50}
            graphData={preparedData}
            backgroundColor={colors.bg}
            nodeThreeObject={nodeThreeObject3D}
            onNodeHover={(node: any) => setHoverNode(node || null)}
            onNodeClick={handleNodeClick}
            linkColor={getLinkColor}
            linkWidth={getLinkWidth}
            linkDirectionalParticles={getLinkDirectionalParticles}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.008}
            linkDirectionalParticleColor={() => colors.particle}
            showNavInfo={false}
          />
        )}

        {/* Floating Tooltip / Information Overlay */}
        {(hoverNode || selectedNodeId) && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              backgroundColor: isDark ? "rgba(30, 41, 59, 0.9)" : "rgba(255, 255, 255, 0.9)",
              border: `1px solid ${colors.border}`,
              backdropFilter: "blur(4px)",
              borderRadius: 8,
              padding: "8px 12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              pointerEvents: "none",
              fontSize: 12,
              color: colors.text,
              maxWidth: 300,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
              {(hoverNode || preparedData.nodes.find((n) => n.id === selectedNodeId))?.title}
            </div>
            {hoverNode?.uncreated && (
              <span style={{ color: colors.nodeUncreated, fontWeight: 600 }}>
                ⚠️ Henüz oluşturulmamış not (Wikilink referansı)
              </span>
            )}
            <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
              💡 Notu editörde açmak için üzerine tıklayın. Sürükleyerek konumlandırabilirsiniz.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
