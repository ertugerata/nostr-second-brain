import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import { nip19 } from "nostr-tools";
import { GraphData, GraphNode, GraphLink } from "../utils/graphBuilder";

export type GraphFilterScope = "mine_and_neighbors" | "mine_only" | "all";

interface SimpleGraphViewProps {
  graphData: GraphData;
  onSelectNode: (id: string) => void;
  theme?: "light" | "dark";
  currentUserPubkey?: string;
}

export const SimpleGraphView: React.FC<SimpleGraphViewProps> = ({
  graphData,
  onSelectNode,
  theme = "light",
}) => {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [filterScope, setFilterScope] = useState<GraphFilterScope>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);

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
      nodeMine: isDark ? "#38bdf8" : "#2563eb",
      nodeNeighbor: isDark ? "#2dd4bf" : "#0d9488",
      nodeUncreated: isDark ? "#f59e0b" : "#d97706",
      nodeOther: isDark ? "#64748b" : "#94a3b8",
      nodeHover: isDark ? "#f43f5e" : "#e11d48",
      nodeSelected: isDark ? "#a855f7" : "#7c3aed",
      linkNormal: isDark ? "#475569" : "#cbd5e1",
      linkHighlight: isDark ? "#38bdf8" : "#2563eb",
      linkDimmed: isDark ? "rgba(30, 41, 59, 0.2)" : "rgba(241, 245, 249, 0.3)",
      particle: isDark ? "#38bdf8" : "#2563eb",
    };
  }, [isDark]);

  // Filter & Prepare data for force graph
  const preparedData = useMemo(() => {
    const rawLinks = graphData.links || graphData.edges || [];
    const allNodes: GraphNode[] = (graphData.nodes || []).map((n) => ({ ...n }));

    // Check if there are any signed mine nodes
    const hasMineNodes = allNodes.some((n) => n.isMine);

    // Filter nodes based on filterScope
    const filteredNodes = allNodes.filter((node) => {
      if (filterScope === "mine_only") {
        return node.isMine || (!hasMineNodes && !node.pubkey);
      }
      if (filterScope === "mine_and_neighbors") {
        return node.isMine || node.isNeighborOfMine || !hasMineNodes;
      }
      return true; // "all"
    });

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

    const links = rawLinks
      .map((l) => ({
        source: typeof l.source === "object" ? (l.source as any).id : l.source,
        target: typeof l.target === "object" ? (l.target as any).id : l.target,
      }))
      .filter((l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target));

    return {
      nodes: filteredNodes,
      links,
      totalCount: allNodes.length,
    };
  }, [graphData, filterScope]);

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
    const query = searchQuery.trim().toLowerCase();

    let searchHexPubkey: string | null = null;
    if (query.startsWith("npub1")) {
      try {
        const decoded = nip19.decode(query);
        if (decoded.type === "npub" && typeof decoded.data === "string") {
          searchHexPubkey = decoded.data;
        }
      } catch (e) {
        // ignore invalid npub while typing
      }
    }

    const matches = new Set<string>();
    preparedData.nodes.forEach((n) => {
      const matchTitle = n.title.toLowerCase().includes(query);
      const matchId = n.id.toLowerCase().includes(query);
      const matchPubkey = n.pubkey ? n.pubkey.toLowerCase().includes(query) : false;
      const matchHex = searchHexPubkey && n.pubkey ? n.pubkey === searchHexPubkey : false;

      let matchNpub = false;
      if (n.pubkey && n.pubkey.length === 64) {
        try {
          matchNpub = nip19.npubEncode(n.pubkey).toLowerCase().includes(query);
        } catch (e) {
          // ignore
        }
      }

      if (matchTitle || matchId || matchPubkey || matchHex || matchNpub) {
        matches.add(n.id);
      }
    });
    return matches;
  }, [searchQuery, preparedData]);

  // Get color for a given node
  const getNodeColor = useCallback(
    (node: GraphNode) => {
      if (node.uncreated) return colors.nodeUncreated;
      if (node.isMine) return colors.nodeMine;
      if (node.isNeighborOfMine) return colors.nodeNeighbor;
      return colors.nodeOther;
    },
    [colors]
  );

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

      const baseColor = getNodeColor(node);

      if (node.uncreated) {
        ctx.fillStyle = colors.nodeUncreated;
        ctx.strokeStyle = isDark ? "#ffffff" : "#000000";
        ctx.setLineDash([2, 2]);
        ctx.stroke();
      } else if (isSelected) {
        ctx.fillStyle = colors.nodeSelected;
      } else if (isHovered) {
        ctx.fillStyle = colors.nodeHover;
      } else {
        ctx.fillStyle = baseColor;
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
    [hoverNode, selectedNodeId, highlightNodes, matchingNodeIds, colors, isDark, getNodeColor]
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

      let colorHex = getNodeColor(node);
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
    [hoverNode, selectedNodeId, highlightNodes, matchingNodeIds, colors, isDark, getNodeColor]
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

  const activeNodeInfo = hoverNode || (selectedNodeId ? preparedData.nodes.find((n) => n.id === selectedNodeId) : null);

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
            {preparedData.nodes.length} Düğüm • {preparedData.links.length} Bağlantı (Toplam: {preparedData.totalCount})
          </span>
        </div>

        {/* Filter, Search & Mode Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Freeze / Unfreeze Animation Button */}
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            title="Grafik fizik simülasyonunu dondur veya serbest bırak"
            style={{
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              backgroundColor: isFrozen ? colors.nodeHover : colors.bg,
              color: isFrozen ? "#ffffff" : colors.text,
              cursor: "pointer",
            }}
          >
            {isFrozen ? "▶️ Hareketi Başlat" : "⏸️ Hareketi Dondur"}
          </button>

          {/* Graph Filter Dropdown */}
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value as GraphFilterScope)}
            title="Ağ Filtreleme"
            style={{
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bg,
              color: colors.text,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="mine_and_neighbors">✍️ Benimki & Bağlantıları</option>
            <option value="mine_only">👤 Yalnızca Benim Notlarım</option>
            <option value="all">🌐 Tüm Notlar (Relay dahil)</option>
          </select>

          <input
            type="text"
            placeholder="Ağda not / npub ara..."
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
              width: 150,
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
                backgroundColor: viewMode === "2d" ? colors.nodeMine : "transparent",
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
                backgroundColor: viewMode === "3d" ? colors.nodeMine : "transparent",
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
            warmupTicks={100}
            cooldownTicks={isFrozen ? 0 : 50}
            d3VelocityDecay={0.6}
            d3AlphaDecay={0.05}
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
            warmupTicks={100}
            cooldownTicks={isFrozen ? 0 : 50}
            d3VelocityDecay={0.6}
            d3AlphaDecay={0.05}
          />
        )}

        {/* Floating Tooltip / Information Overlay */}
        {activeNodeInfo && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              backgroundColor: isDark ? "rgba(30, 41, 59, 0.9)" : "rgba(255, 255, 255, 0.9)",
              border: `1px solid ${colors.border}`,
              backdropFilter: "blur(4px)",
              borderRadius: 8,
              padding: "10px 14px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              pointerEvents: "none",
              fontSize: 12,
              color: colors.text,
              maxWidth: 320,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              {activeNodeInfo.title}
            </div>

            {activeNodeInfo.pubkey && (
              <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                👤 Yazar: {(() => {
                  try {
                    const npub = nip19.npubEncode(activeNodeInfo.pubkey);
                    return `${npub.slice(0, 10)}...${npub.slice(-4)}`;
                  } catch (e) {
                    return `${activeNodeInfo.pubkey.slice(0, 10)}...`;
                  }
                })()}
              </div>
            )}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {activeNodeInfo.isMine ? (
                <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, backgroundColor: colors.nodeMine, color: "#fff", fontWeight: 600 }}>
                  ✍️ Benim Notum
                </span>
              ) : activeNodeInfo.isNeighborOfMine ? (
                <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, backgroundColor: colors.nodeNeighbor, color: "#fff", fontWeight: 600 }}>
                  🔗 Bağlantılı Not
                </span>
              ) : activeNodeInfo.uncreated ? (
                <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, backgroundColor: colors.nodeUncreated, color: "#fff", fontWeight: 600 }}>
                  ⚠️ Henüz Oluşturulmadı
                </span>
              ) : (
                <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, backgroundColor: colors.nodeOther, color: "#fff", fontWeight: 600 }}>
                  🌐 Relay Notu
                </span>
              )}
            </div>

            <div style={{ color: colors.textMuted, fontSize: 11 }}>
              💡 Notu editörde açmak için tıklayın. Sürükleyerek serbestçe konumlandırabilirsiniz.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleGraphView;
