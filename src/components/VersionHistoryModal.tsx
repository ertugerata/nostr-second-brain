import React from "react";
import { NoteItem } from "../utils/exportUtils";

interface VersionHistoryModalProps {
  slug: string;
  versions: NoteItem[];
  onSelectVersion: (version: NoteItem) => void;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  slug,
  versions,
  onSelectVersion,
  onClose,
}) => {
  const sortedVersions = [...versions].sort((a, b) => b.createdAt - a.createdAt);

  return React.createElement(
    "div",
    {
      style: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      },
      onClick: onClose,
    },
    React.createElement(
      "div",
      {
        style: {
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "650px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          overflow: "hidden",
        },
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
      React.createElement(
        "div",
        {
          style: {
            padding: "16px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifySpace: "space-between",
            alignItems: "center",
          },
        },
        React.createElement(
          "h3",
          { style: { fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" } },
          "Versiyon Geçmişi: ",
          React.createElement("span", { style: { color: "var(--accent-blue)" } }, slug)
        ),
        React.createElement(
          "button",
          {
            onClick: onClose,
            style: {
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              color: "var(--text-muted)",
            },
          },
          "✕"
        )
      ),
      React.createElement(
        "div",
        { style: { padding: "16px", overflowY: "auto", flex: 1 } },
        sortedVersions.length === 0
          ? React.createElement(
              "p",
              { style: { color: "var(--text-muted)", fontSize: "14px" } },
              "Bu not için geçmiş versiyon kaydı bulunamadı."
            )
          : React.createElement(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: "12px" } },
              sortedVersions.map((ver, idx) =>
                React.createElement(
                  "div",
                  {
                    key: ver.id || idx,
                    style: {
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      padding: "12px",
                      backgroundColor: idx === 0 ? "var(--bg-secondary)" : "var(--bg-primary)",
                    },
                  },
                  React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      },
                    },
                    React.createElement(
                      "div",
                      null,
                      React.createElement(
                        "span",
                        {
                          style: {
                            fontWeight: 700,
                            fontSize: "13px",
                            color: "var(--text-primary)",
                            marginRight: "8px",
                          },
                        },
                        `Sürüm #${sortedVersions.length - idx} ${idx === 0 ? "(Güncel)" : ""}`
                      ),
                      React.createElement(
                        "span",
                        { style: { fontSize: "12px", color: "var(--text-muted)" } },
                        new Date(ver.createdAt * 1000).toLocaleString("tr-TR")
                      )
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => onSelectVersion(ver),
                        style: {
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: "var(--accent-blue)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        },
                      },
                      "Editöre Yükle"
                    )
                  ),
                  React.createElement(
                    "pre",
                    {
                      style: {
                        fontSize: "12px",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: "120px",
                        overflowY: "auto",
                        background: "var(--code-bg)",
                        color: "var(--text-primary)",
                        padding: "8px",
                        borderRadius: "4px",
                        margin: 0,
                      },
                    },
                    ver.content
                  )
                )
              )
            )
      )
    )
  );
};
