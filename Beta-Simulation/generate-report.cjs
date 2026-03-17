const fs = require("fs");
const path = require("path");
const { formatDuration, round, runAnalysis } = require("./simulation-core.js");

const outputDir = path.join(__dirname, "outputs");
const results = runAnalysis({});

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

function escapeMarkup(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function durationMinutes(seconds) {
  return round(seconds / 60, 2);
}

function percentText(value, digits = 1) {
  return `${round(value, digits)}%`;
}

function minutesText(seconds) {
  return `${round(seconds / 60, 1)}m`;
}

function lateText(summary) {
  if (!summary.lateProbability && !summary.meanLateSeconds) {
    return "Met the ready-by target in every simulated day";
  }

  return `Missed the ready-by target in ${percentText(summary.lateProbability * 100, 0)} of simulated days. Average finish was ${minutesText(summary.meanLateSeconds)} past the target.`;
}

function thresholdCellText(value, mode) {
  if (value === null) {
    return "No break-even";
  }

  if (mode === "machine" && value >= 100) {
    return "Still ahead at 100%";
  }

  if (mode === "parent" && value <= 0) {
    return "0%";
  }

  return `${round(value, 1)}%`;
}

function thresholdLabel(value, mode) {
  if (value === null) {
    return "No useful region in the plotted range";
  }

  if (mode === "parent") {
    if (value <= 0) {
      return "Already useful at 0% compliance";
    }
    if (value >= 100) {
      return "Needs nearly 100% compliance";
    }
    return `Useful from about ${round(value, 1)}% compliance`;
  }

  if (value >= 100) {
    return "Still useful at 100% struggle";
  }

  return `Useful until about ${round(value, 1)}% struggle`;
}

function wrapText(text, maxChars) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function renderTextLines({
  lines,
  x,
  y,
  fontSize = 24,
  lineHeight = 1.35 * fontSize,
  fill = "#221f1a",
  fontFamily = "Avenir Next, Segoe UI, sans-serif",
  fontWeight = 400,
  textAnchor = "start",
  letterSpacing = 0,
}) {
  return lines
    .map((line, index) => {
      const lineY = y + index * lineHeight;
      return `
        <text
          x="${x}"
          y="${lineY}"
          fill="${fill}"
          font-family="${fontFamily}"
          font-size="${fontSize}"
          font-weight="${fontWeight}"
          text-anchor="${textAnchor}"
          letter-spacing="${letterSpacing}"
        >
          ${escapeMarkup(line)}
        </text>
      `;
    })
    .join("");
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3
    ? clean
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : clean;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function interpolateColor(startHex, endHex, ratio) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const t = Math.max(0, Math.min(1, ratio));

  return `rgb(${Math.round(start.r + (end.r - start.r) * t)}, ${Math.round(
    start.g + (end.g - start.g) * t,
  )}, ${Math.round(start.b + (end.b - start.b) * t)})`;
}

function getHeatColor(value, maxAbsValue) {
  if (maxAbsValue <= 0) {
    return "#f6efe3";
  }

  if (value >= 0) {
    return interpolateColor("#f4efe6", "#4f8a69", value / maxAbsValue);
  }

  return interpolateColor("#f4efe6", "#c3674f", Math.abs(value) / maxAbsValue);
}

function writeCsv(filename, header, rows) {
  const content = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
  fs.writeFileSync(path.join(outputDir, filename), `${content}\n`);
}

function buildParentCsv() {
  const series = results.parentSeries[0];
  const rows = series.data.map(function toRow(point) {
    return [
      point.x,
      series.incorrectPercent,
      round(point.y, 3),
      round(point.low, 3),
      round(point.high, 3),
      round(point.lateProbability * 100, 3),
      durationMinutes(point.y),
    ];
  });

  writeCsv(
    "parent-compliance.csv",
    [
      "compliance_percent",
      "incorrect_percent",
      "mean_employee_seconds",
      "p10_employee_seconds",
      "p90_employee_seconds",
      "late_probability_percent",
      "mean_employee_minutes",
    ],
    rows,
  );
}

function buildMachineCsv() {
  const rows = [];

  results.machineSeries.forEach(function eachSeries(series) {
    series.data.forEach(function toRow(point) {
      rows.push([
        point.x,
        series.machineCount,
        results.config.machineIncorrectPercent,
        round(point.y, 3),
        round(point.low, 3),
        round(point.high, 3),
        durationMinutes(point.y),
      ]);
    });
  });

  writeCsv(
    "machine-threshold.csv",
    [
      "struggle_percent",
      "machine_count",
      "incorrect_percent",
      "mean_employee_seconds",
      "p10_employee_seconds",
      "p90_employee_seconds",
      "mean_employee_minutes",
    ],
    rows,
  );
}

function buildHeatmapCsv(filename, rows) {
  writeCsv(
    filename,
    [
      "x_percent",
      "y_percent",
      "employee_minutes_saved",
      "late_probability_percent",
    ],
    rows.map(function toRow(point) {
      return [
        point.x,
        point.y,
        round(point.employeeMinutesSaved, 3),
        round(point.lateProbability, 3),
      ];
    }),
  );
}

function buildDeadlineRiskCsv() {
  const machineOneRisk = results.machineDefaultRiskByCount.find(function find(item) {
    return item.machineCount === 1;
  }).summary;
  const machineTwoRisk = results.machineDefaultRiskByCount.find(function find(item) {
    return item.machineCount === 2;
  }).summary;

  writeCsv(
    "deadline-risk.csv",
    [
      "scenario",
      "mean_employee_seconds",
      "late_probability_percent",
      "mean_late_minutes",
      "p90_late_minutes",
    ],
    [
      [
        "Current process",
        round(results.baseline.meanEmployeeSeconds, 3),
        round(results.baseline.lateProbability * 100, 3),
        round(results.baseline.meanLateSeconds / 60, 3),
        round(results.baseline.p90LateSeconds / 60, 3),
      ],
      [
        "Parent default",
        round(results.parentDefaultSummary.meanEmployeeSeconds, 3),
        round(results.parentDefaultSummary.lateProbability * 100, 3),
        round(results.parentDefaultSummary.meanLateSeconds / 60, 3),
        round(results.parentDefaultSummary.p90LateSeconds / 60, 3),
      ],
      [
        "1 machine default",
        round(machineOneRisk.meanEmployeeSeconds, 3),
        round(machineOneRisk.lateProbability * 100, 3),
        round(machineOneRisk.meanLateSeconds / 60, 3),
        round(machineOneRisk.p90LateSeconds / 60, 3),
      ],
      [
        "2 machine default",
        round(machineTwoRisk.meanEmployeeSeconds, 3),
        round(machineTwoRisk.lateProbability * 100, 3),
        round(machineTwoRisk.meanLateSeconds / 60, 3),
        round(machineTwoRisk.p90LateSeconds / 60, 3),
      ],
    ],
  );
}

function buildSummaryJson() {
  const payload = {
    generatedAt: new Date().toISOString(),
    config: results.config,
    baseline: {
      employeeSeconds: round(results.baseline.meanEmployeeSeconds, 3),
      employeeMinutes: durationMinutes(results.baseline.meanEmployeeSeconds),
      meanCompletionSeconds: round(results.baseline.meanCompletionSeconds, 3),
      lateProbabilityPercent: round(results.baseline.lateProbability * 100, 3),
      meanLateMinutes: round(results.baseline.meanLateSeconds / 60, 3),
    },
    parentThresholds: results.parentThresholdTable.map(function mapRow(item) {
      return {
        incorrectPercent: item.incorrectPercent,
        thresholdPercent:
          item.thresholdPercent === null ? null : round(item.thresholdPercent, 3),
        savedMinutesAtDefault: round(item.savedMinutesAtDefault, 3),
      };
    }),
    machineThresholds: results.machineThresholdTable.map(function mapRow(item) {
      return {
        incorrectPercent: item.incorrectPercent,
        oneMachineThresholdPercent:
          item.oneMachineThresholdPercent === null ? null : round(item.oneMachineThresholdPercent, 3),
        twoMachineThresholdPercent:
          item.twoMachineThresholdPercent === null ? null : round(item.twoMachineThresholdPercent, 3),
        savedMinutesAtDefaultOne: round(item.savedMinutesAtDefaultOne, 3),
        savedMinutesAtDefaultTwo: round(item.savedMinutesAtDefaultTwo, 3),
      };
    }),
    deadlineRiskSaturated:
      results.baseline.lateProbability >= 0.999
      && results.parentDefaultSummary.lateProbability >= 0.999
      && results.machineDefaultRiskByCount.every(function allLate(item) {
        return item.summary.lateProbability >= 0.999;
      }),
  };

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
}

function getSeriesBounds(series, baselineY) {
  const values = [baselineY];

  series.forEach(function eachSeries(line) {
    line.data.forEach(function eachPoint(point) {
      values.push(point.y);
      if (typeof point.low === "number") {
        values.push(point.low);
      }
      if (typeof point.high === "number") {
        values.push(point.high);
      }
    });
  });

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(20, (max - min) * 0.12);

  return {
    min: Math.max(0, min - padding),
    max: max + padding,
  };
}

function renderLegendBlock(x, y, items, colors) {
  let cursorY = y;

  const rows = items
    .map(function renderItem(item, index) {
      const lines = wrapText(item.label, 21);
      const rowHeight = Math.max(28, lines.length * 24);
      const swatchY = cursorY + 11;
      const markup = `
        <line
          x1="${x}"
          y1="${swatchY}"
          x2="${x + 38}"
          y2="${swatchY}"
          stroke="${colors[index]}"
          stroke-width="${item.dashed ? 4 : 6}"
          stroke-dasharray="${item.dashed ? "12 8" : item.strokeDasharray || ""}"
          stroke-linecap="round"
        />
        ${renderTextLines({
          lines,
          x: x + 52,
          y: cursorY + 18,
          fontSize: 20,
          lineHeight: 24,
          fill: "#5f574b",
        })}
      `;
      cursorY += rowHeight + 14;
      return markup;
    })
    .join("");

  return { markup: rows, nextY: cursorY };
}

function renderInsightCard({ x, y, width, eyebrow, value, body, fill }) {
  const valueLines = wrapText(value, 23);
  const bodyLines = wrapText(body, 32);
  const valueHeight = valueLines.length * 32;
  const bodyStartY = y + 102 + valueHeight;
  const height = 32 + 36 + 24 + valueHeight + 18 + bodyLines.length * 22 + 26;

  return {
    height,
    markup: `
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${fill}" />
      ${renderTextLines({
        lines: [eyebrow.toUpperCase()],
        x: x + 24,
        y: y + 34,
        fontSize: 16,
        lineHeight: 18,
        fill: "#6f6559",
        fontWeight: 700,
        letterSpacing: 2,
      })}
      ${renderTextLines({
        lines: valueLines,
        x: x + 24,
        y: y + 76,
        fontSize: 28,
        lineHeight: 32,
        fill: "#221f1a",
        fontFamily: "Iowan Old Style, Palatino Linotype, serif",
        fontWeight: 700,
      })}
      ${renderTextLines({
        lines: bodyLines,
        x: x + 24,
        y: bodyStartY,
        fontSize: 18,
        lineHeight: 22,
        fill: "#5f574b",
      })}
    `,
  };
}

function renderBandChartPage({
  title,
  subtitle,
  xAxisTitle,
  yAxisTitle,
  series,
  colors,
  baselineY,
  thresholdMarkers = [],
  insights,
  bandNote,
}) {
  const width = 1660;
  const height = 1440;
  const plot = { x: 120, y: 270, width: 940, height: 640 };
  const sidebar = { x: 1095, y: 150, width: 450, height: 1180 };
  const bounds = getSeriesBounds(series, baselineY);
  const plotRight = plot.x + plot.width;
  const plotBottom = plot.y + plot.height;
  const theme = {
    backgroundTop: "#fbf5eb",
    backgroundBottom: "#efe4d2",
    card: "#fffdf8",
    ink: "#221f1a",
    muted: "#6f6559",
    grid: "rgba(34, 31, 26, 0.1)",
    baseline: "#b54a36",
  };

  function xScale(value) {
    return plot.x + ((value / 100) * plot.width);
  }

  function yScale(value) {
    return (
      plot.y +
      plot.height -
      ((value - bounds.min) / (bounds.max - bounds.min || 1)) * plot.height
    );
  }

  const grid = [];
  const yTicks = 6;
  const xTicks = 5;

  for (let index = 0; index <= yTicks; index += 1) {
    const value = bounds.min + ((bounds.max - bounds.min) / yTicks) * index;
    const y = yScale(value);
    grid.push(`
      <line x1="${plot.x}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="${theme.grid}" />
      <text
        x="${plot.x - 18}"
        y="${y + 6}"
        text-anchor="end"
        font-size="22"
        fill="${theme.muted}"
        font-family="Avenir Next, Segoe UI, sans-serif"
      >
        ${round(value / 60, 1)}m
      </text>
    `);
  }

  for (let index = 0; index <= xTicks; index += 1) {
    const value = (100 / xTicks) * index;
    const x = xScale(value);
    grid.push(`
      <line x1="${x}" y1="${plot.y}" x2="${x}" y2="${plotBottom}" stroke="${theme.grid}" />
      <text
        x="${x}"
        y="${plotBottom + 38}"
        text-anchor="middle"
        font-size="22"
        fill="${theme.muted}"
        font-family="Avenir Next, Segoe UI, sans-serif"
      >
        ${round(value, 0)}%
      </text>
    `);
  }

  const bandMarkup = series
    .map(function renderBand(line, index) {
      if (line.showBand === false) {
        return "";
      }
      if (!line.data.some(function any(point) {
        return typeof point.low === "number" && typeof point.high === "number";
      })) {
        return "";
      }

      const upper = line.data
        .map(function upperPoint(point) {
          return `${xScale(point.x)},${yScale(point.high)}`;
        })
        .join(" ");
      const lower = line.data
        .slice()
        .reverse()
        .map(function lowerPoint(point) {
          return `${xScale(point.x)},${yScale(point.low)}`;
        })
        .join(" ");

      return `
        <polygon
          points="${upper} ${lower}"
          fill="${withAlpha(colors[index], 0.18)}"
          stroke="none"
        />
      `;
    })
    .join("");

  const lineMarkup = series
    .map(function renderSeries(line, index) {
      const path = line.data
        .map(function pathPoint(point, pointIndex) {
          const command = pointIndex === 0 ? "M" : "L";
          return `${command} ${xScale(point.x)} ${yScale(point.y)}`;
        })
        .join(" ");

      return `
        ${line.outlineStroke
          ? `
            <path
              d="${path}"
              fill="none"
              stroke="${line.outlineStroke}"
              stroke-width="${line.outlineWidth || 10}"
              stroke-dasharray="${line.strokeDasharray || ""}"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          `
          : ""}
        <path
          d="${path}"
          fill="none"
          stroke="${colors[index]}"
          stroke-width="${line.strokeWidth || 6}"
          stroke-dasharray="${line.strokeDasharray || ""}"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      `;
    })
    .join("");

  const markerMarkup = thresholdMarkers
    .filter(function keep(marker) {
      return marker.x >= 0 && marker.x <= 100;
    })
    .map(function renderMarker(marker) {
      const markerX = xScale(marker.x);
      const pillWidth = Math.max(176, marker.label.length * 8.5 + 40);
      const pillX = Math.max(
        plot.x + 10,
        Math.min(plotRight - pillWidth - 10, markerX - pillWidth / 2),
      );
      const pillCenterX = pillX + pillWidth / 2;
      return `
        <line
          x1="${markerX}"
          y1="${plot.y}"
          x2="${markerX}"
          y2="${plotBottom}"
          stroke="${marker.color}"
          stroke-width="3"
          stroke-dasharray="10 10"
        />
        <rect x="${pillX}" y="${plot.y + 16}" width="${pillWidth}" height="38" rx="19" fill="${marker.fill}" />
        <text
          x="${pillCenterX}"
          y="${plot.y + 41}"
          text-anchor="middle"
          font-size="18"
          fill="${marker.color}"
          font-family="Avenir Next, Segoe UI, sans-serif"
          font-weight="700"
        >
          ${escapeMarkup(marker.label)}
        </text>
      `;
    })
    .join("");

  const baselineYCoord = yScale(baselineY);
  const legendItems = [
    { label: `Current process (${formatDuration(baselineY)})`, dashed: true },
    ...series.map(function toLegend(line) {
      return {
        label: line.label,
        strokeDasharray: line.strokeDasharray,
      };
    }),
  ];
  const legend = renderLegendBlock(
    sidebar.x + 28,
    sidebar.y + 78,
    legendItems,
    [theme.baseline, ...colors],
  );

  const bandNoteMarkup = bandNote
    ? renderTextLines({
        lines: wrapText(bandNote, 30),
        x: sidebar.x + 28,
        y: legend.nextY + 10,
        fontSize: 18,
        lineHeight: 22,
        fill: "#5f574b",
      })
    : "";
  const bandNoteHeight = bandNote ? wrapText(bandNote, 30).length * 22 + 24 : 0;
  let insightY = legend.nextY + 26 + bandNoteHeight;
  const insightMarkup = insights
    .map(function renderInsight(insight) {
      const card = renderInsightCard({
        x: sidebar.x + 14,
        y: insightY,
        width: sidebar.width - 28,
        eyebrow: insight.eyebrow,
        value: insight.value,
        body: insight.body,
        fill: insight.fill,
      });
      insightY += card.height + 18;
      return card.markup;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="band-page-bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${theme.backgroundTop}" />
          <stop offset="100%" stop-color="${theme.backgroundBottom}" />
        </linearGradient>
        <filter id="band-page-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#5d4631" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="40" fill="url(#band-page-bg)" />
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="32" fill="${theme.card}" filter="url(#band-page-shadow)" />
      ${renderTextLines({
        lines: [title],
        x: 140,
        y: 92,
        fontSize: 52,
        lineHeight: 54,
        fill: theme.ink,
        fontFamily: "Iowan Old Style, Palatino Linotype, serif",
        fontWeight: 700,
      })}
      ${renderTextLines({
        lines: wrapText(subtitle, 84),
        x: 140,
        y: 132,
        fontSize: 24,
        lineHeight: 30,
        fill: theme.muted,
      })}
      <rect x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}" rx="24" fill="rgba(249, 244, 236, 0.55)" />
      <rect x="${sidebar.x}" y="${sidebar.y}" width="${sidebar.width}" height="${sidebar.height}" rx="28" fill="rgba(238, 244, 249, 0.72)" />
      ${renderTextLines({
        lines: [yAxisTitle],
        x: plot.x,
        y: plot.y - 18,
        fontSize: 20,
        lineHeight: 22,
        fill: theme.muted,
        fontWeight: 700,
      })}
      ${grid.join("")}
      <line
        x1="${plot.x}"
        y1="${baselineYCoord}"
        x2="${plotRight}"
        y2="${baselineYCoord}"
        stroke="${theme.baseline}"
        stroke-width="4"
        stroke-dasharray="14 10"
      />
      ${bandMarkup}
      ${markerMarkup}
      ${lineMarkup}
      <rect x="${plot.x + 14}" y="${baselineYCoord - 44}" width="196" height="34" rx="17" fill="rgba(181, 74, 54, 0.12)" />
      <text
        x="${plot.x + 112}"
        y="${baselineYCoord - 21}"
        text-anchor="middle"
        font-size="17"
        fill="${theme.baseline}"
        font-family="Avenir Next, Segoe UI, sans-serif"
        font-weight="700"
      >
        Current process
      </text>
      <text
        x="${plot.x + plot.width / 2}"
        y="${plotBottom + 82}"
        text-anchor="middle"
        font-size="24"
        fill="${theme.muted}"
        font-family="Avenir Next, Segoe UI, sans-serif"
      >
        ${escapeMarkup(xAxisTitle)}
      </text>
      ${renderTextLines({
        lines: ["LEGEND"],
        x: sidebar.x + 24,
        y: sidebar.y + 42,
        fontSize: 17,
        lineHeight: 19,
        fill: theme.muted,
        fontWeight: 700,
        letterSpacing: 2,
      })}
      ${legend.markup}
      ${bandNoteMarkup}
      ${insightMarkup}
    </svg>
  `.trim();
}

function renderStatCard({ x, y, width, height, eyebrow, valueLines, body, fill }) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="${fill}" />
    ${renderTextLines({
      lines: [eyebrow.toUpperCase()],
      x: x + 28,
      y: y + 38,
      fontSize: 18,
      lineHeight: 20,
      fill: "#6f6559",
      fontWeight: 700,
      letterSpacing: 2,
    })}
    ${renderTextLines({
      lines: valueLines,
      x: x + 28,
      y: y + 94,
      fontSize: 30,
      lineHeight: 36,
      fill: "#221f1a",
      fontFamily: "Iowan Old Style, Palatino Linotype, serif",
      fontWeight: 700,
    })}
    ${renderTextLines({
      lines: wrapText(body, 30),
      x: x + 28,
      y: y + 154,
      fontSize: 18,
      lineHeight: 23,
      fill: "#5f574b",
    })}
  `;
}

function renderCalloutPanel({ x, y, width, height, title, body, fill }) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="30" fill="${fill}" />
    ${renderTextLines({
      lines: [title.toUpperCase()],
      x: x + 28,
      y: y + 42,
      fontSize: 18,
      lineHeight: 20,
      fill: "#6f6559",
      fontWeight: 700,
      letterSpacing: 2,
    })}
    ${renderTextLines({
      lines: wrapText(body, 28),
      x: x + 28,
      y: y + 90,
      fontSize: 22,
      lineHeight: 28,
      fill: "#5f574b",
    })}
  `;
}

function renderAssumptionChip({ x, y, width, height, label, value, fill, maxChars = 20 }) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${fill}" />
    ${renderTextLines({
      lines: [label.toUpperCase()],
      x: x + 24,
      y: y + 34,
      fontSize: 15,
      lineHeight: 16,
      fill: "#6f6559",
      fontWeight: 700,
      letterSpacing: 2,
    })}
    ${renderTextLines({
      lines: wrapText(value, maxChars),
      x: x + 24,
      y: y + 74,
      fontSize: 24,
      lineHeight: 28,
      fill: "#221f1a",
      fontFamily: "Iowan Old Style, Palatino Linotype, serif",
      fontWeight: 700,
    })}
  `;
}

function renderBulletPanel({ x, y, width, height, title, bullets, fill }) {
  let bulletY = y + 92;
  const bulletMarkup = bullets
    .map(function renderBullet(bullet) {
      const lines = wrapText(bullet, 56);
      const markup = `
        <circle cx="${x + 28}" cy="${bulletY - 7}" r="6" fill="#b3572f" />
        ${renderTextLines({
          lines,
          x: x + 48,
          y: bulletY,
          fontSize: 22,
          lineHeight: 28,
          fill: "#5f574b",
        })}
      `;
      bulletY += lines.length * 28 + 26;
      return markup;
    })
    .join("");

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="30" fill="${fill}" />
    ${renderTextLines({
      lines: [title],
      x: x + 28,
      y: y + 48,
      fontSize: 32,
      lineHeight: 34,
      fill: "#221f1a",
      fontFamily: "Iowan Old Style, Palatino Linotype, serif",
      fontWeight: 700,
    })}
    ${bulletMarkup}
  `;
}

function renderHeatmapPanel({
  x,
  y,
  width,
  height,
  title,
  subtitle,
  xLabel,
  yLabel,
  xValues,
  yValues,
  cells,
  thresholdRows,
}) {
  const panelX = x + 72;
  const panelY = y + 154;
  const plotWidth = width - 122;
  const plotHeight = height - 246;
  const cellWidth = plotWidth / xValues.length;
  const cellHeight = plotHeight / yValues.length;
  const maxAbs = Math.max(
    ...cells.map(function value(point) {
      return Math.abs(point.employeeMinutesSaved);
    }),
    1,
  );
  const cellMap = new Map(
    cells.map(function toEntry(point) {
      return [`${point.x}:${point.y}`, point];
    }),
  );

  const cellMarkup = yValues
    .map(function renderRow(yValue, rowIndex) {
      return xValues
        .map(function renderCell(xValue, columnIndex) {
          const cell = cellMap.get(`${xValue}:${yValue}`);
          const cellX = panelX + columnIndex * cellWidth;
          const cellY = panelY + rowIndex * cellHeight;

          return `
            <rect
              x="${cellX}"
              y="${cellY}"
              width="${cellWidth + 0.5}"
              height="${cellHeight + 0.5}"
              fill="${getHeatColor(cell.employeeMinutesSaved, maxAbs)}"
              stroke="rgba(255,255,255,0.45)"
              stroke-width="1"
            />
          `;
        })
        .join("");
    })
    .join("");

  const thresholdPoints = thresholdRows
    .filter(function keep(row) {
      return typeof row.thresholdPercent === "number" && row.thresholdPercent >= 0 && row.thresholdPercent <= 100;
    })
    .map(function toPoint(row) {
      const xIndex = xValues.indexOf(
        xValues.reduce(function nearest(best, current) {
          return Math.abs(current - row.thresholdPercent) < Math.abs(best - row.thresholdPercent)
            ? current
            : best;
        }, xValues[0]),
      );
      const yIndex = yValues.indexOf(row.incorrectPercent);
      return {
        x: panelX + xIndex * cellWidth + cellWidth / 2,
        y: panelY + yIndex * cellHeight + cellHeight / 2,
      };
    });

  const thresholdLine = thresholdPoints.length
    ? `
      <path
        d="${thresholdPoints
          .map(function toPath(point, index) {
            return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
          })
          .join(" ")}"
        fill="none"
        stroke="rgba(255,255,255,0.95)"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      ${thresholdPoints
        .map(function renderPoint(point) {
          return `<circle cx="${point.x}" cy="${point.y}" r="6.5" fill="#ffffff" stroke="#2f6bb3" stroke-width="2" />`;
        })
        .join("")}
    `
    : "";

  const yTicks = yValues
    .map(function renderYTick(value, index) {
      return renderTextLines({
        lines: [`${value}%`],
        x: panelX - 20,
        y: panelY + index * cellHeight + cellHeight / 2 + 7,
        fontSize: 20,
        lineHeight: 22,
        fill: "#6f6559",
        textAnchor: "end",
        fontWeight: 700,
      });
    })
    .join("");

  const xTicks = xValues
    .filter(function everyFifth(_, index) {
      return index % 4 === 0 || index === xValues.length - 1;
    })
    .map(function renderXTick(value) {
      const index = xValues.indexOf(value);
      return renderTextLines({
        lines: [`${value}%`],
        x: panelX + index * cellWidth + cellWidth / 2,
        y: panelY + plotHeight + 36,
        fontSize: 19,
        lineHeight: 21,
        fill: "#6f6559",
        textAnchor: "middle",
        fontWeight: 700,
      });
    })
    .join("");

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="30" fill="rgba(255,255,255,0.72)" />
    ${renderTextLines({
      lines: [title],
      x: x + 28,
      y: y + 44,
      fontSize: 34,
      lineHeight: 36,
      fill: "#221f1a",
      fontFamily: "Iowan Old Style, Palatino Linotype, serif",
      fontWeight: 700,
    })}
    ${renderTextLines({
      lines: wrapText(subtitle, 50),
      x: x + 28,
      y: y + 84,
      fontSize: 18,
      lineHeight: 22,
      fill: "#6f6559",
    })}
    ${renderTextLines({
      lines: [yLabel],
      x: panelX,
      y: y + 128,
      fontSize: 17,
      lineHeight: 19,
      fill: "#6f6559",
      fontWeight: 700,
    })}
    <rect
      x="${panelX}"
      y="${panelY}"
      width="${plotWidth}"
      height="${plotHeight}"
      rx="18"
      fill="rgba(249, 244, 236, 0.25)"
      stroke="rgba(111, 101, 89, 0.18)"
      stroke-width="1.5"
    />
    ${cellMarkup}
    ${thresholdLine}
    ${yTicks}
    ${xTicks}
    ${renderTextLines({
      lines: [xLabel],
      x: panelX + plotWidth / 2,
      y: y + height - 22,
      fontSize: 20,
      lineHeight: 22,
      fill: "#6f6559",
      textAnchor: "middle",
      fontWeight: 700,
    })}
    <rect x="${x + width - 204}" y="${y + 30}" width="170" height="16" rx="8" fill="url(#heat-legend)" />
    ${renderTextLines({
      lines: ["Loses staff time"],
      x: x + width - 208,
      y: y + 24,
      fontSize: 13,
      lineHeight: 15,
      fill: "#6f6559",
      textAnchor: "end",
      fontWeight: 700,
    })}
    ${renderTextLines({
      lines: ["Saves staff time"],
      x: x + width - 34,
      y: y + 24,
      fontSize: 13,
      lineHeight: 15,
      fill: "#6f6559",
      textAnchor: "start",
      fontWeight: 700,
    })}
  `;
}

function renderTablePanel({ x, y, width, title, columns, rows, fill = "rgba(255,255,255,0.72)" }) {
  const rowHeight = 38;
  const headerY = y + 94;
  const bodyStartY = headerY + 24;
  const totalHeight = 120 + rows.length * rowHeight;
  const columnWidth = width / columns.length;

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${totalHeight}" rx="28" fill="${fill}" />
    ${renderTextLines({
      lines: [title],
      x: x + 24,
      y: y + 44,
      fontSize: 30,
      lineHeight: 32,
      fill: "#221f1a",
      fontFamily: "Iowan Old Style, Palatino Linotype, serif",
      fontWeight: 700,
    })}
    ${columns
      .map(function renderColumn(column, index) {
        return renderTextLines({
          lines: [column],
          x: x + 24 + index * columnWidth,
          y: headerY,
          fontSize: 15,
          lineHeight: 17,
          fill: "#6f6559",
          fontWeight: 700,
          letterSpacing: 1.2,
        });
      })
      .join("")}
    <line x1="${x + 20}" y1="${headerY + 14}" x2="${x + width - 20}" y2="${headerY + 14}" stroke="rgba(34,31,26,0.12)" />
    ${rows
      .map(function renderRow(row, rowIndex) {
        const rowY = bodyStartY + rowIndex * rowHeight;
        return `
          <line x1="${x + 20}" y1="${rowY + 18}" x2="${x + width - 20}" y2="${rowY + 18}" stroke="rgba(34,31,26,0.08)" />
          ${row
            .map(function renderCell(cell, cellIndex) {
              return renderTextLines({
                lines: [cell],
                x: x + 24 + cellIndex * columnWidth,
                y: rowY + 10,
                fontSize: 18,
                lineHeight: 20,
                fill: "#221f1a",
              });
            })
            .join("")}
        `;
      })
      .join("")}
  `;
}

function buildDashboardSvg() {
  const width = 1600;
  const height = 1260;
  const machineOneRisk = results.machineDefaultRiskByCount.find(function find(item) {
    return item.machineCount === 1;
  }).summary;
  const machineTwoRisk = results.machineDefaultRiskByCount.find(function find(item) {
    return item.machineCount === 2;
  }).summary;
  const parentThreshold = results.parentThresholds[0];
  const machineOneThreshold = results.machineThresholds.find(function find(item) {
    return item.machineCount === 1;
  });
  const machineTwoThreshold = results.machineThresholds.find(function find(item) {
    return item.machineCount === 2;
  });
  const bullets = [
    "Failures are now split into separate buckets: non-compliance versus incorrect parent application, and struggle-led redo versus incorrect-after-machine.",
    "Late arrivals are modeled as more error-prone, so the break-even thresholds are less optimistic than the earlier independent model.",
  ];
  const caution =
    `The arrival curve peaks about ${results.config.arrivalPeakBeforeDepartureMinutes} minutes before departure, but the ready-by target is ${results.config.departureBufferMinutes} minutes before departure. Some children arrive after the target itself, so the clearer comparison is how far past the target each option finishes.`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="dash-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#fcf6ec" />
          <stop offset="100%" stop-color="#eee0cb" />
        </linearGradient>
        <linearGradient id="dash-accent" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#b3572f" />
          <stop offset="100%" stop-color="#d48450" />
        </linearGradient>
        <filter id="dash-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="#5b432e" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="40" fill="url(#dash-bg)" />
      <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="34" fill="#fffdf8" filter="url(#dash-shadow)" />
      <rect x="88" y="88" width="620" height="256" rx="34" fill="url(#dash-accent)" />
      ${renderTextLines({
        lines: ["ESC102 / DAYCARE FIELD TRIP"],
        x: 128,
        y: 142,
        fontSize: 22,
        lineHeight: 24,
        fill: "#f9eadf",
        fontWeight: 700,
        letterSpacing: 4,
      })}
      ${renderTextLines({
        lines: ["Wristband", "Simulation"],
        x: 128,
        y: 218,
        fontSize: 76,
        lineHeight: 84,
        fill: "#fffaf5",
        fontFamily: "Iowan Old Style, Palatino Linotype, serif",
        fontWeight: 700,
      })}
      ${renderTextLines({
        lines: ["Simulation setup"],
        x: 792,
        y: 120,
        fontSize: 18,
        lineHeight: 20,
        fill: "#6f6559",
        fontWeight: 700,
        letterSpacing: 2,
      })}
      ${renderAssumptionChip({
        x: 792,
        y: 148,
        width: 316,
        height: 106,
        label: "Children",
        value: `${results.config.children} children`,
        fill: "#f4efe7",
      })}
      ${renderAssumptionChip({
        x: 1128,
        y: 148,
        width: 316,
        height: 106,
        label: "Check-in lines",
        value: `${results.config.classrooms} classrooms`,
        fill: "#eef4fb",
      })}
      ${renderAssumptionChip({
        x: 792,
        y: 270,
        width: 316,
        height: 118,
        label: "Ready-by deadline",
        value: `${results.config.departureBufferMinutes} minutes before departure`,
        fill: "#fdf3ea",
        maxChars: 18,
      })}
      ${renderAssumptionChip({
        x: 1128,
        y: 270,
        width: 316,
        height: 154,
        label: "Correlation",
        value: "Late arrivals are more likely to fail",
        fill: "#eef6f0",
        maxChars: 14,
      })}
      ${renderStatCard({
        x: 88,
        y: 430,
        width: 320,
        height: 248,
        eyebrow: "Current process",
        valueLines: [
          formatDuration(results.baseline.meanEmployeeSeconds),
          `${minutesText(results.baseline.meanLateSeconds)} past target`,
        ],
        body: `Missed the ready-by target in ${percentText(results.baseline.lateProbability * 100, 0)} of simulated days.`,
        fill: "#fff4ec",
      })}
      ${renderStatCard({
        x: 432,
        y: 430,
        width: 320,
        height: 248,
        eyebrow: "Parent default",
        valueLines: [
          formatDuration(results.parentDefaultSummary.meanEmployeeSeconds),
          `${minutesText(results.parentDefaultSummary.meanLateSeconds)} past target`,
        ],
        body: `${results.config.defaultParentCompliancePercent}% compliance and ${results.config.parentIncorrectPercent}% wrong among parents who try. Break-even: ${round(parentThreshold.thresholdPercent, 1)}% compliance.`,
        fill: "#eef5fd",
      })}
      ${renderStatCard({
        x: 776,
        y: 430,
        width: 320,
        height: 248,
        eyebrow: "1 machine default",
        valueLines: [
          formatDuration(machineOneRisk.meanEmployeeSeconds),
          `${minutesText(machineOneRisk.meanLateSeconds)} past target`,
        ],
        body: `${results.config.defaultMachineStrugglePercent}% struggle and ${results.config.machineIncorrectPercent}% wrong after machine use. Break-even: ${round(machineOneThreshold.thresholdPercent, 1)}% struggle.`,
        fill: "#edf6ee",
      })}
      ${renderStatCard({
        x: 1120,
        y: 430,
        width: 320,
        height: 248,
        eyebrow: "2 machines default",
        valueLines: [
          formatDuration(machineTwoRisk.meanEmployeeSeconds),
          `${minutesText(machineTwoRisk.meanLateSeconds)} past target`,
        ],
        body: `Same inputs, but less crowding reduces failure conversion. Break-even: ${round(machineTwoThreshold.thresholdPercent, 1)}% struggle.`,
        fill: "#f4f1fb",
      })}
      ${renderBulletPanel({
        x: 88,
        y: 724,
        width: 820,
        height: 360,
        title: "What Changed",
        bullets,
        fill: "#fff9f1",
      })}
      ${renderCalloutPanel({
        x: 944,
        y: 724,
        width: 496,
        height: 360,
        title: "Deadline caveat",
        body: caution,
        fill: "#fff9f1",
      })}
    </svg>
  `.trim();
}

function buildAtlasSvg() {
  const width = 1660;
  const height = 1440;
  const heatParentXValues = Array.from(
    new Set(results.parentHeatmap.map(function pick(point) {
      return point.x;
    })),
  );
  const heatParentYValues = Array.from(
    new Set(results.parentHeatmap.map(function pick(point) {
      return point.y;
    })),
  );
  const heatMachineXValues = Array.from(
    new Set(results.machineHeatmap.map(function pick(point) {
      return point.x;
    })),
  );
  const heatMachineYValues = Array.from(
    new Set(results.machineHeatmap.map(function pick(point) {
      return point.y;
    })),
  );
  const machineOneRisk = results.machineDefaultRiskByCount.find(function find(item) {
    return item.machineCount === 1;
  }).summary;
  const machineTwoRisk = results.machineDefaultRiskByCount.find(function find(item) {
    return item.machineCount === 2;
  }).summary;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="atlas-bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#fbf5eb" />
          <stop offset="100%" stop-color="#efe4d2" />
        </linearGradient>
        <linearGradient id="heat-legend" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="#c3674f" />
          <stop offset="50%" stop-color="#f4efe6" />
          <stop offset="100%" stop-color="#4f8a69" />
        </linearGradient>
        <filter id="atlas-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#5d4631" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="40" fill="url(#atlas-bg)" />
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="32" fill="#fffdf8" filter="url(#atlas-shadow)" />
      ${renderTextLines({
        lines: ["Sensitivity Atlas"],
        x: 140,
        y: 92,
        fontSize: 52,
        lineHeight: 54,
        fill: "#221f1a",
        fontFamily: "Iowan Old Style, Palatino Linotype, serif",
        fontWeight: 700,
      })}
      ${renderTextLines({
        lines: wrapText("Heatmaps show employee minutes saved versus the current process. White dots mark the estimated break-even contour.", 96),
        x: 140,
        y: 132,
        fontSize: 24,
        lineHeight: 30,
        fill: "#6f6559",
      })}
      ${renderHeatmapPanel({
        x: 88,
        y: 178,
        width: 708,
        height: 474,
        title: "Parent Heatmap",
        subtitle: "Green cells save employee time; red cells add employee time versus the current process.",
        xLabel: "Parent compliance (%)",
        yLabel: "Wrong among parents who tried (%)",
        xValues: heatParentXValues,
        yValues: heatParentYValues,
        cells: results.parentHeatmap,
        thresholdRows: results.parentThresholdTable,
      })}
      ${renderHeatmapPanel({
        x: 852,
        y: 178,
        width: 708,
        height: 474,
        title: "1-Machine Heatmap",
        subtitle: "Green cells save employee time; red cells add employee time versus the current process.",
        xLabel: "Machine struggle (%)",
        yLabel: "Wrong after machine use (%)",
        xValues: heatMachineXValues,
        yValues: heatMachineYValues,
        cells: results.machineHeatmap,
        thresholdRows: results.machineThresholdTable.map(function mapRow(item) {
          return {
            incorrectPercent: item.incorrectPercent,
            thresholdPercent: item.oneMachineThresholdPercent,
          };
        }),
      })}
      ${renderTablePanel({
        x: 88,
        y: 702,
        width: 480,
        title: "Parent Break-even Table",
        columns: ["Incorrect", "Break-even", "Saved @ 70%"],
        rows: results.parentThresholdTable.map(function mapRow(item) {
          return [
            `${item.incorrectPercent}%`,
            item.thresholdPercent === null ? "None" : `${round(item.thresholdPercent, 1)}%`,
            `${round(item.savedMinutesAtDefault, 1)}m`,
          ];
        }),
      })}
      ${renderTablePanel({
        x: 604,
        y: 702,
        width: 560,
        title: "Machine Break-even Table",
        columns: ["Incorrect", "1 machine", "2 machines"],
        rows: results.machineThresholdTable.map(function mapRow(item) {
          return [
            `${item.incorrectPercent}%`,
            thresholdCellText(item.oneMachineThresholdPercent, "machine"),
            thresholdCellText(item.twoMachineThresholdPercent, "machine"),
          ];
        }),
      })}
      ${renderTablePanel({
        x: 1200,
        y: 702,
        width: 360,
        title: "Deadline Risk Table",
        columns: ["Scenario", "Missed target", "Avg past target"],
        rows: [
          [
            "Current",
            percentText(results.baseline.lateProbability * 100, 0),
            minutesText(results.baseline.meanLateSeconds),
          ],
          [
            "Parent",
            percentText(results.parentDefaultSummary.lateProbability * 100, 0),
            minutesText(results.parentDefaultSummary.meanLateSeconds),
          ],
          [
            "1 machine",
            percentText(machineOneRisk.lateProbability * 100, 0),
            minutesText(machineOneRisk.meanLateSeconds),
          ],
          [
            "2 machines",
            percentText(machineTwoRisk.lateProbability * 100, 0),
            minutesText(machineTwoRisk.meanLateSeconds),
          ],
        ],
      })}
      ${renderBulletPanel({
        x: 88,
        y: 980,
        width: 930,
        height: 300,
        title: "Interpretation",
        bullets: [
          "Parent heatmap: move right to model higher parent compliance. Move down to model more parents who tried but still put the band on incorrectly.",
          "Machine heatmap: move right to model more families struggling at the machine. Move down to model more machine attempts that still need staff correction.",
        ],
        fill: "#fff9f1",
      })}
      ${renderCalloutPanel({
        x: 1052,
        y: 980,
        width: 508,
        height: 300,
        title: "Why the deadline saturates",
        body: "Because the arrival curve still extends past the ready-by target, the miss rate stays at 100% in the default setup. The more useful comparison is the average minutes each option finishes past that target.",
        fill: "#fff9f1",
      })}
    </svg>
  `.trim();
}

function buildParentFailureMixText(counts) {
  return `${Math.round(counts.success || 0)} correct, ${Math.round(counts.nonCompliant || 0)} no band, ${Math.round(counts.incorrectApplied || 0)} still needed redo.`;
}

function buildMachineFailureMixText(counts) {
  return `${Math.round(counts.success || 0)} clean, ${Math.round(counts.struggleRedo || 0)} redo after struggle, ${Math.round(counts.incorrectAfterMachine || 0)} still needed correction.`;
}

function buildReportHtml() {
  const machineOneRisk = results.machineDefaultRiskByCount.find(function find(item) {
    return item.machineCount === 1;
  }).summary;
  const machineTwoRisk = results.machineDefaultRiskByCount.find(function find(item) {
    return item.machineCount === 2;
  }).summary;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Beta Simulation Report</title>
        <style>
          :root {
            --bg: #f4efe6;
            --panel: rgba(255, 252, 247, 0.88);
            --ink: #221f1a;
            --muted: #6f6559;
            --accent: #b3572f;
            --border: rgba(60, 45, 29, 0.1);
            --shadow: 0 22px 46px rgba(63, 49, 34, 0.12);
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Avenir Next", "Segoe UI", sans-serif;
            color: var(--ink);
            background:
              radial-gradient(circle at top left, rgba(240, 197, 168, 0.75), transparent 28%),
              linear-gradient(180deg, #f9f4eb, var(--bg));
          }
          .shell {
            width: min(1280px, calc(100vw - 32px));
            margin: 0 auto;
            padding: 28px 0 42px;
          }
          .hero, .panel {
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 28px;
            box-shadow: var(--shadow);
            backdrop-filter: blur(14px);
          }
          .hero {
            padding: 28px;
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 18px;
            margin-bottom: 18px;
          }
          h1, h2 {
            margin: 0;
            font-family: "Iowan Old Style", "Palatino Linotype", serif;
          }
          h1 { font-size: 3.2rem; line-height: 0.95; }
          h2 { font-size: 1.7rem; }
          p { line-height: 1.6; }
          .eyebrow {
            margin: 0 0 10px;
            color: var(--accent);
            font-size: 0.82rem;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-weight: 700;
          }
          .hero-card {
            border-radius: 22px;
            padding: 22px;
            background: linear-gradient(180deg, rgba(255, 247, 238, 0.94), rgba(255, 252, 249, 0.78));
          }
          .hero-card strong {
            display: block;
            font-size: 2rem;
            margin: 12px 0 8px;
          }
          .cards {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-top: 16px;
          }
          .card {
            padding: 18px;
            border-radius: 18px;
            background: rgba(255,255,255,0.72);
            border: 1px solid var(--border);
          }
          .card h3 {
            margin: 0 0 10px;
            color: var(--muted);
            font-size: 0.84rem;
            text-transform: uppercase;
            letter-spacing: 0.14em;
          }
          .card strong {
            display: block;
            font-size: 1.55rem;
            line-height: 1.2;
            margin-bottom: 8px;
          }
          .panel {
            padding: 24px;
            margin-top: 18px;
          }
          img {
            width: 100%;
            border-radius: 22px;
            display: block;
            border: 1px solid var(--border);
            background: #fff;
          }
          .muted { color: var(--muted); }
          @media (max-width: 980px) {
            .hero, .cards { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <section class="hero">
            <div>
              <p class="eyebrow">ESC102 / Beta-Simulation</p>
              <h1>Daycare Wristband Prototype Report</h1>
              <p class="muted">
                The upgraded simulation now tracks separate failure types, late-arrival correlation, employee minutes,
                confidence bands, and a ready-by deadline set ${results.config.departureBufferMinutes} minutes before departure.
              </p>
            </div>
            <div class="hero-card">
              <span class="muted">Current process employee time</span>
              <strong>${formatDuration(results.baseline.meanEmployeeSeconds)}</strong>
              <p class="muted">
                Default deadline risk: missed the ready-by target in ${percentText(results.baseline.lateProbability * 100, 0)}
                of simulated days, with an average finish ${minutesText(results.baseline.meanLateSeconds)} past the target.
              </p>
            </div>
          </section>

          <section class="panel">
            <h2>Decision Summary</h2>
            <div class="cards">
              <article class="card">
                <h3>Parent default</h3>
                <strong>${formatDuration(results.parentDefaultSummary.meanEmployeeSeconds)}</strong>
                <p class="muted">${thresholdLabel(results.parentThresholds[0].thresholdPercent, "parent")}. ${lateText(results.parentDefaultSummary)}</p>
              </article>
              <article class="card">
                <h3>1 machine default</h3>
                <strong>${formatDuration(machineOneRisk.meanEmployeeSeconds)}</strong>
                <p class="muted">${thresholdLabel(results.machineThresholds.find((item) => item.machineCount === 1).thresholdPercent, "machine")}. ${lateText(machineOneRisk)}</p>
              </article>
              <article class="card">
                <h3>2 machines default</h3>
                <strong>${formatDuration(machineTwoRisk.meanEmployeeSeconds)}</strong>
                <p class="muted">${thresholdLabel(results.machineThresholds.find((item) => item.machineCount === 2).thresholdPercent, "machine")}. ${lateText(machineTwoRisk)}</p>
              </article>
            </div>
          </section>

          <section class="panel">
            <h2>Dashboard</h2>
            <img src="./decision-dashboard.svg" alt="Simulation decision dashboard" />
          </section>

          <section class="panel">
            <h2>Parent Employee-Time Curve</h2>
            <img src="./parent-compliance.svg" alt="Parent compliance chart with confidence band" />
          </section>

          <section class="panel">
            <h2>Machine Employee-Time Curve</h2>
            <img src="./machine-threshold.svg" alt="Machine threshold chart with confidence band" />
          </section>

          <section class="panel">
            <h2>Sensitivity Atlas</h2>
            <img src="./sensitivity-atlas.svg" alt="Parent and machine heatmaps with break-even tables" />
          </section>
        </div>
      </body>
    </html>
  `.trim();
}

const parentIncorrectPercent = results.parentSeries[0].incorrectPercent;
const parentFailureMix = buildParentFailureMixText(results.parentDefaultSummary.meanFailureCounts);
const machineFailureMix = buildMachineFailureMixText(results.machineDefaultSummary.meanFailureCounts);
const machineOneRisk = results.machineDefaultRiskByCount.find(function find(item) {
  return item.machineCount === 1;
}).summary;
const machineTwoRisk = results.machineDefaultRiskByCount.find(function find(item) {
  return item.machineCount === 2;
}).summary;
const machineOneThreshold = results.machineThresholds.find(function find(item) {
  return item.machineCount === 1;
});
const machineTwoThreshold = results.machineThresholds.find(function find(item) {
  return item.machineCount === 2;
});

const parentSvg = renderBandChartPage({
  title: "Parent Compliance",
  subtitle:
    "Employee time versus parent compliance. Each child costs about 3 to 5 seconds to verify when the band is usable, plus 25 extra seconds if staff must redo it.",
  xAxisTitle: "Parent compliance (%)",
  yAxisTitle: "Employee time (minutes)",
  series: results.parentSeries,
  colors: ["#2f6bb3"],
  baselineY: results.parentEmployeeBaselineSeconds,
  thresholdMarkers:
    results.parentThresholds[0].thresholdPercent === null
      ? []
      : [
          {
            x: results.parentThresholds[0].thresholdPercent,
            label: "Break-even",
            color: "#2f6bb3",
            fill: "rgba(47, 107, 179, 0.12)",
          },
        ],
  bandNote: "Blue shading = the middle 80% of simulated days for this parent curve.",
  insights: [
    {
      eyebrow: "Break-even",
      value: thresholdLabel(results.parentThresholds[0].thresholdPercent, "parent"),
      body: `This is based on ${parentIncorrectPercent}% incorrect application among parents who try before entering.`,
      fill: "#fff4ec",
    },
    {
      eyebrow: "Default case",
      value: `${formatDuration(results.parentDefaultSummary.meanEmployeeSeconds)} staff time`,
      body: `${results.config.defaultParentCompliancePercent}% compliance and ${results.config.parentIncorrectPercent}% wrong among parents who try. ${lateText(results.parentDefaultSummary)}`,
      fill: "#eef5fd",
    },
    {
      eyebrow: "Failure mix",
      value: "Average out of 90",
      body: parentFailureMix,
      fill: "#f4f1fb",
    },
  ],
});

const machineSvg = renderBandChartPage({
  title: "Machine Struggle Threshold",
  subtitle:
    "Employee time versus the share of families who struggle at the machine. Both lines use the same staff-time metric as the parent chart.",
  xAxisTitle: "Parents who struggle at the machine (%)",
  yAxisTitle: "Employee time (minutes)",
  series: results.machineSeries.map(function styleMachineSeries(line, index) {
    if (index === 0) {
      return Object.assign({}, line, {
        showBand: true,
        strokeWidth: 6,
      });
    }

    return Object.assign({}, line, {
      showBand: false,
      strokeWidth: 7,
      outlineStroke: "#fffdf8",
      outlineWidth: 12,
    });
  }),
  colors: ["#2f6bb3", "#4d7a58"],
  baselineY: results.parentEmployeeBaselineSeconds,
  thresholdMarkers: [machineOneThreshold, machineTwoThreshold]
    .filter(function keep(item) {
      return item && typeof item.thresholdPercent === "number";
    })
    .map(function toMarker(item) {
      return {
        x: item.thresholdPercent,
        label: item.machineCount === 1 ? "1-machine" : "2-machines",
        color: item.machineCount === 1 ? "#2f6bb3" : "#4d7a58",
        fill: item.machineCount === 1 ? "rgba(47, 107, 179, 0.12)" : "rgba(77, 122, 88, 0.12)",
      };
    }),
  insights: [
    {
      eyebrow: "Break-even",
      value: `${thresholdLabel(machineOneThreshold.thresholdPercent, "machine")} / ${thresholdLabel(machineTwoThreshold.thresholdPercent, "machine")}`,
      body: "",
      fill: "#eef5fd",
    },
    {
      eyebrow: "Default case",
      value: `${formatDuration(results.machineDefaultSummary.meanEmployeeSeconds)} staff time`,
      body: `${results.config.defaultMachineStrugglePercent}% struggle and ${results.config.machineIncorrectPercent}% wrong after machine use. 1 machine finished ${minutesText(machineOneRisk.meanLateSeconds)} past target on average. 2 machines finished ${minutesText(machineTwoRisk.meanLateSeconds)} past target on average.`,
      fill: "#fff4ec",
    },
    {
      eyebrow: "Failure mix",
      value: "Average out of 90",
      body: machineFailureMix,
      fill: "#f4f1fb",
    },
  ],
});

fs.writeFileSync(path.join(outputDir, "decision-dashboard.svg"), `${buildDashboardSvg()}\n`);
fs.writeFileSync(path.join(outputDir, "parent-compliance.svg"), `${parentSvg}\n`);
fs.writeFileSync(path.join(outputDir, "machine-threshold.svg"), `${machineSvg}\n`);
fs.writeFileSync(path.join(outputDir, "sensitivity-atlas.svg"), `${buildAtlasSvg()}\n`);
fs.writeFileSync(path.join(outputDir, "report.html"), `${buildReportHtml()}\n`);

buildParentCsv();
buildMachineCsv();
buildHeatmapCsv("parent-heatmap.csv", results.parentHeatmap);
buildHeatmapCsv("machine-heatmap.csv", results.machineHeatmap);
buildDeadlineRiskCsv();
buildSummaryJson();

console.log("Generated static report assets:");
console.log(`- ${path.join(outputDir, "report.html")}`);
console.log(`- ${path.join(outputDir, "decision-dashboard.svg")}`);
console.log(`- ${path.join(outputDir, "parent-compliance.svg")}`);
console.log(`- ${path.join(outputDir, "machine-threshold.svg")}`);
console.log(`- ${path.join(outputDir, "sensitivity-atlas.svg")}`);
