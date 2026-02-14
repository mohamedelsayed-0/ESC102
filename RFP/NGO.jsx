import { useState, useRef, useCallback } from "react";

/* ── Color constants ── */
const GOAL_LIGHT_FILLS = {
  "#3B82F6": "#EFF6FF",
  "#10B981": "#ECFDF5",
  "#F59E0B": "#FFFBEB",
  "#EF4444": "#FEF2F2",
  "#8B5CF6": "#F5F3FF",
};

/* ── Data: Need → Goals → Objectives ── */
const GOALS = [
  {
    id: "g1",
    label: "Clear Communication",
    color: "#3B82F6",
    objectives: [
      "Relay messages clearly during entire belaying process",
      "Recipient specificity & command verification",
      "Messages relayed quickly & consistently",
      "Only intended messages relayed",
    ],
  },
  {
    id: "g2",
    label: "Climbing Experience",
    color: "#10B981",
    objectives: [
      "Does not restrict movements",
      "Does not significantly increase weight on climber",
      "Can be operated hands-free or with one hand",
      "Does not distract the climber",
    ],
  },
  {
    id: "g3",
    label: "Belaying Experience",
    color: "#F59E0B",
    objectives: [
      "No uncomfortable position for belayer",
      "Does not make rope-pulling more difficult",
      "Does not slow belayer reaction time",
    ],
  },
  {
    id: "g4",
    label: "Safety",
    color: "#EF4444",
    objectives: [
      "Does not impede use of safety equipment",
      "Should not cause greater injury during falls",
      "Fails safely — safety checks in place",
      "Does not introduce new hazards (e.g. entanglement)",
    ],
  },
  {
    id: "g5",
    label: "Ease of Operation",
    color: "#8B5CF6",
    objectives: [
      "Easy to set up",
      "Should not require great force to operate",
      "Should not require greater than normal dexterity",
      "Actions for different messages are distinct & clear",
      "Intuitive & easy to learn, especially for newer climbers",
      "Operates for at least 3 consecutive hours",
    ],
  },
];

/* ── Helpers ── */
function wrap(text, max) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 30) * Math.PI) / 180;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

function curvePath(x1, y1, x2, y2, bend = 0.12) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return `M${x1},${y1} Q${mx - dy * bend},${my + dx * bend} ${x2},${y2}`;
}

/* ── Layout constants ── */

/* 3 columns: Need (hub) → Goals (hexagons) → Objectives (pills) */
const COL_HUB = 350;
const COL_GOAL = 950;
const COL_OBJ = 1900;

const HUB_R = 310;
const HEX_R = 160;

const OBJ_BOX_W = 950;
const OBJ_BOX_H = 80;
const OBJ_GAP = 135;
const GOAL_GAP = 56;

/* ── Layout engine ── */
function computeLayout() {
  const goals = [];
  let y = 50;

  for (let gi = 0; gi < GOALS.length; gi++) {
    const goal = GOALS[gi];
    const objCount = goal.objectives.length;
    const totalH = objCount * OBJ_GAP;

    const goalY = y + totalH / 2;
    const goalData = { ...goal, x: COL_GOAL, y: goalY, objs: [] };

    /* lay out objectives vertically centered on the goal */
    let oy = goalY - totalH / 2 + OBJ_GAP / 2;
    for (let oi = 0; oi < objCount; oi++) {
      goalData.objs.push({
        text: goal.objectives[oi],
        x: COL_OBJ,
        y: oy,
      });
      oy += OBJ_GAP;
    }

    goals.push(goalData);
    y = goalY + totalH / 2 + GOAL_GAP + 48;
  }

  return goals;
}

/* ── Component ── */
export default function NGOFlowchart() {
  const svgRef = useRef(null);
  const layout = computeLayout();

  /* compute tight bounds */
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function expand(x, y, padX = 100, padY = 100) {
    if (x - padX < minX) minX = x - padX;
    if (y - padY < minY) minY = y - padY;
    if (x + padX > maxX) maxX = x + padX;
    if (y + padY > maxY) maxY = y + padY;
  }

  for (const g of layout) {
    expand(g.x, g.y, HEX_R + 30, HEX_R + 30);
    for (const o of g.objs) {
      expand(o.x, o.y, OBJ_BOX_W / 2 + 30, 50);
    }
  }

  /* Hub: center vertically on goals */
  const firstY = layout[0].y;
  const lastY = layout[layout.length - 1].y;
  const hubY = (firstY + lastY) / 2;
  expand(COL_HUB, hubY, HUB_R + 50, HUB_R + 50);

  /* padding */
  minX -= 40;
  minY -= 50;
  maxX += 40;
  maxY += 60;

  const vbW = maxX - minX;
  const vbH = maxY - minY;

  /* Legend */
  const legendW = 540;
  const legendH = 88;
  const legendX = minX + vbW / 2 - legendW / 2;
  const legendY = maxY - legendH - 16;

  /* Hub text lines */
  const hubLines = wrap("A fast and clear method to relay messages between a climber and their belayer", 28);

  const handleDownload = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    /* render at 3x for crisp output */
    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = vbW * scale;
    canvas.height = vbH * scale;

    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "NGO_Flowchart.png";
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  }, [vbW, vbH]);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, Helvetica, sans-serif",
        position: "relative",
      }}
    >
      <button
        onClick={handleDownload}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          padding: "10px 20px",
          background: "#3B82F6",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
        }}
      >
        ⬇ Download PNG
      </button>
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100vw",
          maxHeight: "100vh",
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="sh">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="4"
              floodColor="#94A3B8"
              floodOpacity="0.12"
            />
          </filter>
        </defs>

        <rect x={minX} y={minY} width={vbW} height={vbH} fill="#FFFFFF" />

        {/* ── Connection lines ── */}
        {layout.map((goal) => (
          <g key={goal.id + "-lines"}>
            {/* Hub → Goal */}
            <path
              d={curvePath(COL_HUB + HUB_R * 0.85, hubY, goal.x - HEX_R, goal.y, 0.03)}
              fill="none"
              stroke={goal.color}
              strokeWidth={3.5}
              opacity={0.4}
            />
            {/* Goal → Objectives */}
            {goal.objs.map((o, oi) => (
              <path
                key={oi}
                d={`M${goal.x + HEX_R},${goal.y} L${o.x - OBJ_BOX_W / 2},${o.y}`}
                fill="none"
                stroke={goal.color}
                strokeWidth={2.5}
                opacity={0.35}
              />
            ))}
          </g>
        ))}

        {/* ── Central Hub (Need) ── */}
        <circle
          cx={COL_HUB}
          cy={hubY}
          r={HUB_R + 40}
          fill="rgba(59,130,246,0.04)"
          stroke="rgba(59,130,246,0.12)"
          strokeWidth={2}
        />
        <circle
          cx={COL_HUB}
          cy={hubY}
          r={HUB_R}
          fill="#FFFFFF"
          stroke="#CBD5E1"
          strokeWidth={3.5}
          filter="url(#sh)"
        />
        <text
          x={COL_HUB}
          y={hubY - HUB_R * 0.45}
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fill="#94A3B8"
          fontSize={36}
          fontWeight={700}
          letterSpacing="0.14em"
        >
          NEED
        </text>
        {hubLines.map((l, li) => (
          <text
            key={li}
            x={COL_HUB}
            y={hubY - HUB_R * 0.18 + li * 46}
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fill="#1E40AF"
            fontSize={40}
            fontWeight={700}
          >
            {l}
          </text>
        ))}

        {/* ── Goal nodes (hexagons) ── */}
        {layout.map((goal, gi) => {
          const labelLines = wrap(goal.label, 12);
          return (
            <g key={goal.id}>
              <polygon
                points={hexPoints(goal.x, goal.y, HEX_R)}
                fill={GOAL_LIGHT_FILLS[goal.color] || "#F8FAFC"}
                stroke={goal.color}
                strokeWidth={3}
                filter="url(#sh)"
              />
              <text
                x={goal.x}
                y={goal.y - 50}
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fill={goal.color}
                fontSize={30}
                fontWeight={700}
                letterSpacing="0.06em"
              >
                GOAL {gi + 1}
              </text>
              {labelLines.map((l, li) => (
                <text
                  key={li}
                  x={goal.x}
                  y={goal.y + 2 + li * 40}
                  textAnchor="middle"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fill="#1E293B"
                  fontSize={38}
                  fontWeight={700}
                >
                  {l}
                </text>
              ))}

              {/* ── Objectives (pills) ── */}
              {goal.objs.map((obj, oi) => {
                const lines = wrap(obj.text, 40);
                const bH = Math.max(OBJ_BOX_H, 34 + lines.length * 48);
                return (
                  <g key={oi}>
                    <rect
                      x={obj.x - OBJ_BOX_W / 2}
                      y={obj.y - bH / 2}
                      width={OBJ_BOX_W}
                      height={bH}
                      rx={bH / 2}
                      fill="#FFFFFF"
                      stroke={goal.color}
                      strokeWidth={2.5}
                      filter="url(#sh)"
                    />
                    {lines.map((l, li) => (
                      <text
                        key={li}
                        x={obj.x}
                        y={
                          obj.y -
                          ((lines.length - 1) * 24) +
                          li * 48 +
                          16
                        }
                        textAnchor="middle"
                        fontFamily="Arial, Helvetica, sans-serif"
                        fill="#334155"
                        fontSize={45}
                        fontWeight={600}
                      >
                        {l}
                      </text>
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── Legend ── */}
        <rect
          x={legendX}
          y={legendY}
          width={legendW}
          height={legendH}
          rx={12}
          fill="#FFFFFF"
          stroke="#3B82F6"
          strokeWidth={2.5}
          filter="url(#sh)"
        />
        <text
          x={legendX + 28}
          y={legendY + legendH / 2 + 9}
          fontFamily="Arial, Helvetica, sans-serif"
          fill="#64748B"
          fontSize={24}
          fontWeight={800}
          letterSpacing="0.08em"
        >
          LEGEND
        </text>
        {/* Goal icon (hexagon) */}
        <polygon
          points={hexPoints(legendX + 210, legendY + legendH / 2, 24)}
          fill="#EFF6FF"
          stroke="#3B82F6"
          strokeWidth={2.5}
        />
        <text
          x={legendX + 256}
          y={legendY + legendH / 2 + 9}
          fontFamily="Arial, Helvetica, sans-serif"
          fill="#1E293B"
          fontSize={27}
          fontWeight={700}
        >
          Goal
        </text>
        {/* Objective icon (pill) */}
        <rect
          x={legendX + 355}
          y={legendY + legendH / 2 - 18}
          width={72}
          height={36}
          rx={18}
          fill="#FFFFFF"
          stroke="#3B82F6"
          strokeWidth={2}
        />
        <text
          x={legendX + 452}
          y={legendY + legendH / 2 + 9}
          fontFamily="Arial, Helvetica, sans-serif"
          fill="#1E293B"
          fontSize={27}
          fontWeight={700}
        >
          Obj.
        </text>
      </svg>
    </div>
  );
}
