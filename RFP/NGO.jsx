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

function curvePath(x1, y1, x2, y2, bend = 0.1) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return `M${x1},${y1} Q${mx - dy * bend},${my + dx * bend} ${x2},${y2}`;
}

/* ── Layout constants ── */
const COL_HUB = 450;
const COL_GOAL = 1150;
const COL_OBJ = 2250;

const HUB_R = 350;
const HEX_R = 180;

const OBJ_BOX_W = 1100;
const OBJ_GAP = 140;
const GOAL_GAP = 60;

/* ── Layout engine ── */
function computeLayout() {
  const goals = [];
  let y = 100;

  for (let gi = 0; gi < GOALS.length; gi++) {
    const goal = GOALS[gi];
    const objCount = goal.objectives.length;
    const totalH = objCount * OBJ_GAP;

    const goalY = y + totalH / 2;
    const goalData = { ...goal, x: COL_GOAL, y: goalY, objs: [] };

    let oy = goalY - (totalH / 2) + (OBJ_GAP / 2);
    for (let oi = 0; oi < objCount; oi++) {
      goalData.objs.push({
        text: goal.objectives[oi],
        x: COL_OBJ,
        y: oy,
      });
      oy += OBJ_GAP;
    }

    goals.push(goalData);
    y = goalY + totalH / 2 + GOAL_GAP + 60;
  }

  return goals;
}

export default function NGOFlowchart() {
  const svgRef = useRef(null);
  const layout = computeLayout();

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  function expand(x, y, padX = 200, padY = 200) {
    if (x - padX < minX) minX = x - padX;
    if (y - padY < minY) minY = y - padY;
    if (x + padX > maxX) maxX = x + padX;
    if (y + padY > maxY) maxY = y + padY;
  }

  for (const g of layout) {
    expand(g.x, g.y, HEX_R + 50, HEX_R + 50);
    for (const o of g.objs) {
      expand(o.x, o.y, OBJ_BOX_W / 2 + 50, 60);
    }
  }

  const firstY = layout[0].y;
  const lastY = layout[layout.length - 1].y;
  const hubY = (firstY + lastY) / 2;
  expand(COL_HUB, hubY, HUB_R + 100, HUB_R + 100);

  minX -= 100;
  minY -= 100;
  maxX += 100;
  maxY += 250;

  const vbW = maxX - minX;
  const vbH = maxY - minY;

  const legendW = 600;
  const legendH = 100;
  const legendX = minX + vbW / 2 - legendW / 2;
  const legendY = maxY - legendH - 40;

  const hubLines = wrap("A fast and clear method to relay messages between a climber and their belayer", 28);

  const handleDownload = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
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
    <div style={{ width: "3500px", height: "4500px", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', Arial, sans-serif", WebkitPrintColorAdjust: "exact" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @media print {
          body { margin: 0; padding: 0; }
          div { overflow: visible !important; }
        }
      `}</style>
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
        style={{ width: "100%", height: "100%", maxWidth: "100vw", maxHeight: "100vh" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.08" />
          </filter>
        </defs>

        <rect x={minX} y={minY} width={vbW} height={vbH} fill="#FFFFFF" />

        {/* ── Connections ── */}
        {layout.map((goal) => (
          <g key={goal.id}>
            <path
              d={curvePath(COL_HUB + HUB_R * 0.8, hubY, goal.x - HEX_R, goal.y, 0.05)}
              fill="none" stroke={goal.color} strokeWidth={4} opacity={0.3}
            />
            {goal.objs.map((o, oi) => (
              <path
                key={oi}
                d={`M${goal.x + HEX_R},${goal.y} L${o.x - OBJ_BOX_W / 2},${o.y}`}
                fill="none" stroke={goal.color} strokeWidth={2.5} opacity={0.3}
              />
            ))}
          </g>
        ))}

        {/* ── Hub ── */}
        <circle cx={COL_HUB} cy={hubY} r={HUB_R + 50} fill="rgba(59,130,246,0.03)" stroke="rgba(59,130,246,0.08)" strokeWidth={2} />
        <circle cx={COL_HUB} cy={hubY} r={HUB_R} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={4} filter="url(#sh)" />
        <text x={COL_HUB} y={hubY - HUB_R * 0.45} textAnchor="middle" fill="#94A3B8" fontSize={42} fontWeight={800} letterSpacing="0.15em">NEED</text>
        {hubLines.map((l, li) => (
          <text key={li} x={COL_HUB} y={hubY - HUB_R * 0.15 + li * 52} textAnchor="middle" fill="#1E40AF" fontSize={48} fontWeight={700}>{l}</text>
        ))}

        {/* ── Goals ── */}
        {layout.map((goal, gi) => {
          const lines = wrap(goal.label, 14);
          return (
            <g key={goal.id}>
              <polygon points={hexPoints(goal.x, goal.y, HEX_R)} fill={GOAL_LIGHT_FILLS[goal.color]} stroke={goal.color} strokeWidth={4} filter="url(#sh)" />
              <text x={goal.x} y={goal.y - 55} textAnchor="middle" fill={goal.color} fontSize={32} fontWeight={800} letterSpacing="0.05em">GOAL {gi + 1}</text>
              {lines.map((l, li) => (
                <text key={li} x={goal.x} y={goal.y + 10 + li * 44} textAnchor="middle" fill="#1F2937" fontSize={40} fontWeight={700}>{l}</text>
              ))}

              {/* ── Objectives ── */}
              {goal.objs.map((o, oi) => {
                const oLines = wrap(o.text, 40);
                const oH = Math.max(90, 40 + oLines.length * 52);
                return (
                  <g key={oi}>
                    <rect x={o.x - OBJ_BOX_W / 2} y={o.y - oH / 2} width={OBJ_BOX_W} height={oH} rx={oH / 2} fill="#FFFFFF" stroke={goal.color} strokeWidth={2.5} filter="url(#sh)" />
                    {oLines.map((l, li) => (
                      <text key={li} x={o.x} y={o.y - ((oLines.length - 1) * 26) + li * 52 + 18} textAnchor="middle" fill="#374151" fontSize={48} fontWeight={600}>{l}</text>
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── Legend ── */}
        <rect x={legendX} y={legendY} width={legendW} height={legendH} rx={16} fill="#FFFFFF" stroke="#3B82F6" strokeWidth={3} filter="url(#sh)" />
        <text x={legendX + 40} y={legendY + legendH / 2 + 10} fill="#64748B" fontSize={28} fontWeight={800} letterSpacing="0.1em">LEGEND</text>
        <polygon points={hexPoints(legendX + 240, legendY + legendH / 2, 28)} fill="#EFF6FF" stroke="#3B82F6" strokeWidth={3} />
        <text x={legendX + 285} y={legendY + legendH / 2 + 10} fill="#111827" fontSize={30} fontWeight={700}>Goal</text>
        <rect x={legendX + 400} y={legendY + legendH / 2 - 20} width={80} height={40} rx={20} fill="#FFFFFF" stroke="#3B82F6" strokeWidth={2.5} />
        <text x={legendX + 505} y={legendY + legendH / 2 + 10} fill="#111827" fontSize={30} fontWeight={700}>Obj.</text>
      </svg>
    </div>
  );
}
