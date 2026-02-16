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
    label: "Clear communication between the climber and the belayer",
    color: "#3B82F6",
    objectives: [
      "6.1.1 Messages can be sent and received across a 40-foot distance.",
      "6.1.2 Messages can be understood in loud environments.",
      "6.1.3 The intended recipient is easily identifiable as per ISO 9241-112:2017.",
      "6.1.4 The messages are relayed quickly as per ISO 9241-112:2025.",
      "6.1.5 Only intended messages are relayed; avoid inadvertent activation.",
      "6.1.6 Must facilitate two-way communication. Each message sent must have a corresponding confirmation from the receiver.",
      "6.1.7 Should facilitate at least 6 unique messages corresponding to commonly used commands.",
    ],
  },
  {
    id: "g2",
    label: "Does not impede the climbing experience",
    color: "#10B981",
    objectives: [
      "6.2.1 Does not restrict users' range of motion.",
      "6.2.2 Any worn components are lightweight.",
      "6.2.3 Can be operated with at most one hand.",
    ],
  },
  {
    id: "g3",
    label: "Does not impede the belaying experience",
    color: "#F59E0B",
    objectives: [
      "6.3.1 Does not require the belayer to remain in a position less natural than typically required.",
      "6.3.2 Does not increase the difficulty of pulling ropes as per ISO 24553:2023.",
    ],
  },
  {
    id: "g4",
    label: "Ensure the safety of climbers and belayers",
    color: "#EF4444",
    objectives: [
      "6.4.1 Does not distract users as per ISO/TR 17427-10:2015 standard for distractions while driving.",
      "6.4.2 More urgent messages concerning the safety of the climber should have the least latency and high salience as per ISO 11249:1996.",
    ],
  },
  {
    id: "g5",
    label: "Easy to operate",
    color: "#8B5CF6",
    objectives: [
      "6.5.1 Should be quick to set up per climb.",
      "6.5.2 Does not require great force to operate as per ISO 24553:2023.",
      "6.5.4 Does not require greater than usual dexterity to operate as per ISO 24553:2023.",
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
const COL_OBJ = 2380;

const HUB_R = 350;
const HEX_R = 235;

const OBJ_BOX_W = 1300;
const OBJ_WRAP_CHARS = 36;
const OBJ_LINE_HEIGHT = 60;
const OBJ_MIN_H = 124;
const OBJ_STACK_GAP = 56;
const GOAL_GAP = 40;
const GROUP_GAP = 24;

const GOAL_WRAP_CHARS = 14;
const GOAL_TITLE_FONT = 38;
const GOAL_BODY_FONT = 50;
const GOAL_BODY_LINE_HEIGHT = 46;
const GOAL_TITLE_OFFSET_Y = -104;
const GOAL_BODY_CENTER_OFFSET_Y = 28;

const HUB_WRAP_CHARS = 24;
const HUB_TITLE_FONT = 46;
const HUB_BODY_FONT = 50;
const HUB_BODY_LINE_HEIGHT = 54;

function objectiveHeight(text) {
  const lineCount = wrap(text, OBJ_WRAP_CHARS).length;
  return Math.max(OBJ_MIN_H, 40 + lineCount * OBJ_LINE_HEIGHT);
}

/* ── Layout engine ── */
function computeLayout() {
  const goals = [];
  let y = 100;

  for (let gi = 0; gi < GOALS.length; gi++) {
    const goal = GOALS[gi];
    const objsWithHeight = goal.objectives.map((text) => ({
      text,
      h: objectiveHeight(text),
    }));
    const totalH =
      objsWithHeight.reduce((sum, obj) => sum + obj.h, 0) +
      Math.max(0, objsWithHeight.length - 1) * OBJ_STACK_GAP;

    const goalY = y + totalH / 2;
    const goalData = { ...goal, x: COL_GOAL, y: goalY, objs: [] };

    let oy = goalY - totalH / 2;
    for (const obj of objsWithHeight) {
      goalData.objs.push({
        text: obj.text,
        x: COL_OBJ,
        y: oy + obj.h / 2,
        h: obj.h,
      });
      oy += obj.h + OBJ_STACK_GAP;
    }

    goals.push(goalData);
    y = goalY + totalH / 2 + GOAL_GAP + GROUP_GAP;
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
      expand(o.x, o.y, OBJ_BOX_W / 2 + 50, o.h / 2 + 30);
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

  const hubLines = wrap("A fast and clear method to relay messages between a climber and their belayer", HUB_WRAP_CHARS);

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
        <text x={COL_HUB} y={hubY - HUB_R * 0.45} textAnchor="middle" fill="#94A3B8" fontSize={HUB_TITLE_FONT} fontWeight={800} letterSpacing="0.15em">NEED</text>
        {hubLines.map((l, li) => (
          <text key={li} x={COL_HUB} y={hubY - HUB_R * 0.2 + li * HUB_BODY_LINE_HEIGHT} textAnchor="middle" fill="#1E40AF" fontSize={HUB_BODY_FONT} fontWeight={700}>{l}</text>
        ))}

        {/* ── Goals ── */}
        {layout.map((goal, gi) => {
          const lines = wrap(goal.label, GOAL_WRAP_CHARS);
          const goalBodyFont = lines.length > 4 ? GOAL_BODY_FONT - 3 : GOAL_BODY_FONT;
          const goalBodyLineHeight =
            lines.length > 4 ? GOAL_BODY_LINE_HEIGHT - 3 : GOAL_BODY_LINE_HEIGHT;
          const goalBodyStartY =
            goal.y +
            GOAL_BODY_CENTER_OFFSET_Y -
            ((lines.length - 1) * goalBodyLineHeight) / 2;
          return (
            <g key={goal.id}>
              <polygon points={hexPoints(goal.x, goal.y, HEX_R)} fill={GOAL_LIGHT_FILLS[goal.color]} stroke={goal.color} strokeWidth={4} filter="url(#sh)" />
              <text
                x={goal.x}
                y={goal.y + GOAL_TITLE_OFFSET_Y}
                textAnchor="middle"
                fill={goal.color}
                fontSize={GOAL_TITLE_FONT}
                fontWeight={800}
                letterSpacing="0.05em"
              >
                GOAL {gi + 1}
              </text>
              {lines.map((l, li) => (
                <text
                  key={li}
                  x={goal.x}
                  y={goalBodyStartY + li * goalBodyLineHeight}
                  textAnchor="middle"
                  fill="#1F2937"
                  fontSize={goalBodyFont}
                  fontWeight={700}
                >
                  {l}
                </text>
              ))}

              {/* ── Objectives ── */}
              {goal.objs.map((o, oi) => {
                const oLines = wrap(o.text, OBJ_WRAP_CHARS);
                return (
                  <g key={oi}>
                    <rect x={o.x - OBJ_BOX_W / 2} y={o.y - o.h / 2} width={OBJ_BOX_W} height={o.h} rx={o.h / 2} fill="#FFFFFF" stroke={goal.color} strokeWidth={2.5} filter="url(#sh)" />
                    {oLines.map((l, li) => (
                      <text key={li} x={o.x} y={o.y - ((oLines.length - 1) * (OBJ_LINE_HEIGHT / 2)) + li * OBJ_LINE_HEIGHT + 22} textAnchor="middle" fill="#374151" fontSize={58} fontWeight={600}>{l}</text>
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── Legend ── */}
        <rect x={legendX} y={legendY} width={legendW} height={legendH} rx={16} fill="#FFFFFF" stroke="#3B82F6" strokeWidth={3} filter="url(#sh)" />
        <text x={legendX + 40} y={legendY + legendH / 2 + 10} fill="#64748B" fontSize={30} fontWeight={800} letterSpacing="0.1em">LEGEND</text>
        <polygon points={hexPoints(legendX + 240, legendY + legendH / 2, 28)} fill="#EFF6FF" stroke="#3B82F6" strokeWidth={3} />
        <text x={legendX + 285} y={legendY + legendH / 2 + 10} fill="#111827" fontSize={32} fontWeight={700}>Goal</text>
        <rect x={legendX + 400} y={legendY + legendH / 2 - 20} width={80} height={40} rx={20} fill="#FFFFFF" stroke="#3B82F6" strokeWidth={2.5} />
        <text x={legendX + 505} y={legendY + legendH / 2 + 10} fill="#111827" fontSize={32} fontWeight={700}>Obj.</text>
      </svg>
    </div>
  );
}
