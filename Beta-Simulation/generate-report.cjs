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

function renderWrappedText(options) {
  const lines = wrapText(options.text, options.maxChars);
  return renderTextLines({ ...options, lines });
}

function writeCsv(filename, header, rows) {
  const content = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
  fs.writeFileSync(path.join(outputDir, filename), `${content}\n`);
}

function buildParentCsv() {
  const rows = [];

  results.parentSeries.forEach((series) => {
    series.data.forEach((point) => {
      rows.push([
        point.x,
        series.label,
        round(point.y, 3),
        durationMinutes(point.y),
      ]);
    });
  });

  writeCsv(
    "parent-compliance.csv",
    [
      "compliance_percent",
      "series_label",
      "employee_time_seconds",
      "employee_time_minutes",
    ],
    rows,
  );
}

function buildMachineCsv() {
  const rows = [];

  results.machineSeries.forEach((series) => {
    series.data.forEach((point) => {
      rows.push([
        point.x,
        series.machineCount,
        round(point.y, 3),
        durationMinutes(point.y),
      ]);
    });
  });

  writeCsv(
    "machine-threshold.csv",
    [
      "struggle_percent",
      "machine_count",
      "mean_completion_seconds",
      "mean_completion_minutes",
    ],
    rows,
  );
}

function buildSummaryJson() {
  const payload = {
    generatedAt: new Date().toISOString(),
    config: results.config,
    baseline: {
      meanCompletionSeconds: round(results.baseline.meanCompletionSeconds, 3),
      meanCompletionMinutes: durationMinutes(results.baseline.meanCompletionSeconds),
      formatted: formatDuration(results.baseline.meanCompletionSeconds),
    },
    parentEmployeeBaseline: {
      seconds: round(results.parentEmployeeBaselineSeconds, 3),
      minutes: durationMinutes(results.parentEmployeeBaselineSeconds),
      formatted: formatDuration(results.parentEmployeeBaselineSeconds),
    },
    parentThresholds: results.parentThresholds.map((item) => ({
      label: item.label,
      thresholdPercent:
        item.thresholdPercent === null ? null : round(item.thresholdPercent, 3),
      interpretation: thresholdLabel(item.thresholdPercent, "parent"),
    })),
    machineThresholds: results.machineThresholds.map((item) => ({
      machineCount: item.machineCount,
      thresholdPercent:
        item.thresholdPercent === null ? null : round(item.thresholdPercent, 3),
      interpretation: thresholdLabel(item.thresholdPercent, "machine"),
    })),
  };

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
}

function getSeriesRange(series) {
  const values = [];
  series.data.forEach((point) => values.push(point.y));
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function formatRangeLines(minSeconds, maxSeconds) {
  return [formatDuration(minSeconds), `to ${formatDuration(maxSeconds)}`];
}

function getSeriesBounds(series, baselineY) {
  const values = [baselineY];
  series.forEach((line) => {
    line.data.forEach((point) => values.push(point.y));
  });

  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(20, (max - min) * 0.12);
  return { min: Math.max(0, min - padding), max: max + padding };
}

function renderLegendBlock(x, y, items, colors) {
  let cursorY = y;

  const rows = items
    .map((item, index) => {
      const lines = wrapText(item.label, 22);
      const rowHeight = Math.max(30, lines.length * 24);
      const swatchY = cursorY + 12;
      const textY = cursorY + 18;
      const markup = `
        <line
          x1="${x}"
          y1="${swatchY}"
          x2="${x + 38}"
          y2="${swatchY}"
          stroke="${colors[index]}"
          stroke-width="${item.dashed ? 4 : 6}"
          stroke-dasharray="${item.dashed ? "12 8" : ""}"
          stroke-linecap="round"
        />
        ${renderTextLines({
          lines,
          x: x + 52,
          y: textY,
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
  const valueLines = wrapText(value, 24);
  const bodyLines = wrapText(body, 28);
  const valueHeight = valueLines.length * 32;
  const bodyHeight = bodyLines.length * 23;
  const bodyStartY = y + 102 + valueHeight;
  const height = 30 + 34 + 26 + valueHeight + 18 + bodyHeight + 26;

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
        fontSize: 19,
        lineHeight: 23,
        fill: "#5f574b",
      })}
    `,
  };
}

function renderLineChart({
  title,
  subtitle,
  xAxisTitle,
  yAxisTitle = "Completion time (minutes)",
  series,
  colors,
  baselineY,
  legendTitle,
  insights,
  thresholdMarkers = [],
}) {
  const width = 1660;
  const height = 1120;
  const plot = { x: 120, y: 270, width: 940, height: 640 };
  const sidebar = { x: 1095, y: 150, width: 450, height: 860 };
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

  const yTicks = 6;
  const xTicks = 5;
  const grid = [];

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

  const pathMarkup = series
    .map((line, index) => {
      const path = line.data
        .map((point, pointIndex) => {
          const command = pointIndex === 0 ? "M" : "L";
          return `${command} ${xScale(point.x)} ${yScale(point.y)}`;
        })
        .join(" ");

      return `
        <path
          d="${path}"
          fill="none"
          stroke="${colors[index]}"
          stroke-width="6"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      `;
    })
    .join("");

  const markerMarkup = thresholdMarkers
    .filter((marker) => marker.x >= 0 && marker.x <= 100)
    .map((marker) => {
      const markerX = xScale(marker.x);
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
        <rect x="${markerX - 88}" y="${plot.y + 16}" width="176" height="38" rx="19" fill="${marker.fill}" />
        <text
          x="${markerX}"
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
    ...series.map((line) => ({ label: line.label })),
  ];
  const legendColors = [theme.baseline, ...colors];
  const legend = renderLegendBlock(sidebar.x + 28, sidebar.y + 78, legendItems, legendColors);

  let insightY = legend.nextY + 38;
  const insightMarkup = insights
    .map((insight) => {
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
        <linearGradient id="page-bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${theme.backgroundTop}" />
          <stop offset="100%" stop-color="${theme.backgroundBottom}" />
        </linearGradient>
        <filter id="page-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#5d4631" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="40" fill="url(#page-bg)" />
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="32" fill="${theme.card}" filter="url(#page-shadow)" />
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
        lines: wrapText(subtitle, 82),
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
      ${markerMarkup}
      ${pathMarkup}
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
        lines: [legendTitle.toUpperCase()],
        x: sidebar.x + 24,
        y: sidebar.y + 42,
        fontSize: 17,
        lineHeight: 19,
        fill: theme.muted,
        fontWeight: 700,
        letterSpacing: 2,
      })}
      ${legend.markup}
      ${insightMarkup}
    </svg>
  `.trim();
}

function renderStatCard({
  x,
  y,
  width,
  height,
  eyebrow,
  valueLines,
  body,
  fill,
  bodyMaxChars = 28,
  bodyFontSize = 18,
  bodyLineHeight = 23,
}) {
  const bodyLines = wrapText(body, bodyMaxChars);
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
      lines: bodyLines,
      x: x + 28,
      y: y + 154,
      fontSize: bodyFontSize,
      lineHeight: bodyLineHeight,
      fill: "#5f574b",
    })}
  `;
}

function renderAssumptionChip({
  x,
  y,
  width,
  height,
  label,
  value,
  fill,
  valueMaxChars = 20,
}) {
  const valueLines = wrapText(value, valueMaxChars);
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
      lines: valueLines,
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
    .map((bullet) => {
      const lines = wrapText(bullet, 46);
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

function buildDashboardSvg() {
  const width = 1600;
  const height = 1060;
  const baseline = formatDuration(results.baseline.meanCompletionSeconds);
  const employeeBaseline = formatDuration(results.parentEmployeeBaselineSeconds);
  const machineOne = results.machineThresholds.find((item) => item.machineCount === 1);
  const machineTwo = results.machineThresholds.find((item) => item.machineCount === 2);
  const parentRange = results.parentSeries.reduce(
    (range, series) => {
      const next = getSeriesRange(series);
      return {
        min: Math.min(range.min, next.min),
        max: Math.max(range.max, next.max),
      };
    },
    { min: Infinity, max: -Infinity },
  );
  const machineOneRange = getSeriesRange(
    results.machineSeries.find((item) => item.machineCount === 1),
  );
  const machineTwoRange = getSeriesRange(
    results.machineSeries.find((item) => item.machineCount === 2),
  );

  const leftBullets = [
    "Parent delegation becomes useful once enough families avoid the extra 25-second redo step.",
    "Compliant child: 5 seconds of staff time. Failed parent case: 30 seconds total.",
    "A 9-minute arrival peak creates a sharper rush, so machine queues matter more.",
  ];

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="hero-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#fcf6ec" />
          <stop offset="100%" stop-color="#eee0cb" />
        </linearGradient>
        <linearGradient id="accent-bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#b3572f" />
          <stop offset="100%" stop-color="#d48450" />
        </linearGradient>
        <filter id="dash-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="#5b432e" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="40" fill="url(#hero-bg)" />
      <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="34" fill="#fffdf8" filter="url(#dash-shadow)" />
      <rect x="88" y="88" width="620" height="256" rx="34" fill="url(#accent-bg)" />
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
        height: 126,
        label: "Arrivals",
        value: `${results.config.arrivalWindowMinutes}m window, peak ${round(results.config.arrivalPeakBeforeDepartureMinutes, 1)}m before departure`,
        fill: "#fdf3ea",
        valueMaxChars: 17,
      })}
      ${renderAssumptionChip({
        x: 1128,
        y: 270,
        width: 316,
        height: 126,
        label: "Machine",
        value: `${results.config.machineBaseSeconds}s base + 5 to 15s struggle time`,
        fill: "#eef6f0",
        valueMaxChars: 18,
      })}
      ${renderStatCard({
        x: 88,
        y: 424,
        width: 332,
        height: 214,
        eyebrow: "Current process",
        valueLines: [employeeBaseline],
        body: "Employee time for wristbanding and attendance in the current process.",
        fill: "#fff4ec",
      })}
      ${renderStatCard({
        x: 444,
        y: 424,
        width: 332,
        height: 214,
        eyebrow: "Parent model",
        valueLines: formatRangeLines(parentRange.min, parentRange.max),
        body: "5 seconds per child if compliant, plus 25 extra seconds for every missed or incorrect wristband.",
        fill: "#eef5fd",
        bodyMaxChars: 26,
      })}
      ${renderStatCard({
        x: 800,
        y: 456,
        width: 332,
        height: 232,
        eyebrow: "1 machine",
        valueLines: formatRangeLines(machineOneRange.min, machineOneRange.max),
        body: `Useful until about ${round(machineOne.thresholdPercent, 1)}% of parents struggle at the machine.`,
        fill: "#edf6ee",
        bodyMaxChars: 24,
      })}
      ${renderStatCard({
        x: 1156,
        y: 456,
        width: 332,
        height: 232,
        eyebrow: "2 machines",
        valueLines: formatRangeLines(machineTwoRange.min, machineTwoRange.max),
        body: "The second station stays faster across the plotted range, even with heavy struggle.",
        fill: "#f4f1fb",
        bodyMaxChars: 24,
      })}
      ${renderBulletPanel({
        x: 88,
        y: 700,
        width: 1400,
        height: 270,
        title: "What This Means",
        bullets: leftBullets,
        fill: "#fff9f1",
      })}
    </svg>
  `.trim();
}

function buildReportHtml() {
  const parentRows = results.parentThresholds
    .map(
      (item) => `
        <tr>
          <td>${escapeMarkup(item.label)}</td>
          <td>${escapeMarkup(thresholdLabel(item.thresholdPercent, "parent"))}</td>
        </tr>
      `,
    )
    .join("");

  const machineRows = results.machineThresholds
    .map(
      (item) => `
        <tr>
          <td>${item.machineCount}</td>
          <td>${escapeMarkup(thresholdLabel(item.thresholdPercent, "machine"))}</td>
        </tr>
      `,
    )
    .join("");

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
          .grid {
            display: grid;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: 18px;
          }
          .panel {
            padding: 24px;
          }
          .panel.wide { grid-column: span 12; }
          .panel.half { grid-column: span 6; }
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
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }
          th, td {
            padding: 12px 10px;
            text-align: left;
            border-top: 1px solid var(--border);
          }
          th {
            color: var(--muted);
            font-size: 0.85rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
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
            .hero, .cards, .grid { grid-template-columns: 1fr; }
            .panel.half { grid-column: span 12; }
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
                This report compares the current wristband process against two proposed alternatives:
                parents applying wristbands before class check-in, and a dispensing machine with one or two stations.
              </p>
            </div>
            <div class="hero-card">
              <span class="muted">Current process employee time</span>
              <strong>${formatDuration(results.parentEmployeeBaselineSeconds)}</strong>
              <p class="muted">
                Assumptions: ${results.config.children} children, ${results.config.classrooms} classrooms,
                a ${results.config.arrivalWindowMinutes}-minute arrival window peaking ${round(results.config.arrivalPeakBeforeDepartureMinutes, 1)} minutes before departure,
                and ${results.config.runs} Monte Carlo runs per point.
              </p>
            </div>
          </section>

          <section class="panel wide">
            <h2>Decision Summary</h2>
            <div class="cards">
              <article class="card">
                <h3>Parent model</h3>
                <strong>${escapeMarkup(thresholdLabel(results.parentThresholds[0].thresholdPercent, "parent"))}</strong>
                <p class="muted">Staff time uses 5 seconds per child if compliant, plus 25 extra seconds for each missed or incorrect wristband.</p>
              </article>
              <article class="card">
                <h3>1 machine</h3>
                <strong>${escapeMarkup(thresholdLabel(results.machineThresholds[0].thresholdPercent, "machine"))}</strong>
                <p class="muted">This is the approximate struggle-rate limit before the machine queue becomes slower than the current process.</p>
              </article>
              <article class="card">
                <h3>2 machines</h3>
                <strong>${escapeMarkup(thresholdLabel(results.machineThresholds[1].thresholdPercent, "machine"))}</strong>
                <p class="muted">With two machines, the queue effect stays weak enough that the machine remains faster across the full plotted range.</p>
              </article>
            </div>
          </section>

          <div class="grid" style="margin-top: 18px;">
            <section class="panel half">
              <h2>Parent Threshold Table</h2>
              <table>
                <thead>
                  <tr><th>Series</th><th>Useful region</th></tr>
                </thead>
                <tbody>${parentRows}</tbody>
              </table>
            </section>
            <section class="panel half">
              <h2>Machine Threshold Table</h2>
              <table>
                <thead>
                  <tr><th>Machines</th><th>Useful region</th></tr>
                </thead>
                <tbody>${machineRows}</tbody>
              </table>
            </section>
            <section class="panel wide">
              <h2>Decision Dashboard</h2>
              <img src="./decision-dashboard.svg" alt="Simulation decision dashboard" />
            </section>
            <section class="panel wide">
              <h2>Parent Compliance Threshold</h2>
              <img src="./parent-compliance.svg" alt="Parent compliance threshold chart" />
            </section>
            <section class="panel wide">
              <h2>Machine Threshold</h2>
              <img src="./machine-threshold.svg" alt="Machine threshold chart" />
            </section>
          </div>
        </div>
      </body>
    </html>
  `.trim();
}

const parentSvg = renderLineChart({
  title: "Parent Compliance Threshold",
  subtitle:
    "The solid line is employee time for the parent model. It assumes 5 seconds per child if compliant, plus 25 extra seconds for each missed or incorrect wristband.",
  xAxisTitle: "Parent compliance (%)",
  yAxisTitle: "Employee time (minutes)",
  series: results.parentSeries,
  colors: ["#2f6bb3"],
  baselineY: results.parentEmployeeBaselineSeconds,
  legendTitle: "Legend",
  insights: [
    {
      eyebrow: "Decision",
      value: thresholdLabel(results.parentThresholds[0].thresholdPercent, "parent"),
      body: "This is the compliance point where delegated wristbands start saving employee time compared with the current process.",
      fill: "#fff4ec",
    },
  ],
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
});

const machineOneThreshold = results.machineThresholds.find(
  (item) => item.machineCount === 1,
);
const machineTwoThreshold = results.machineThresholds.find(
  (item) => item.machineCount === 2,
);

const machineSvg = renderLineChart({
  title: "Machine Threshold",
  subtitle:
    "The blue line is one machine. The green line is two machines. All runs use a tighter arrival rush peaking about 9 minutes before departure.",
  xAxisTitle: "Parents who struggle at the machine (%)",
  yAxisTitle: "Completion time (minutes)",
  series: results.machineSeries,
  colors: ["#2f6bb3", "#4d7a58"],
  baselineY: results.baseline.meanCompletionSeconds,
  legendTitle: "Legend",
  insights: [
    {
      eyebrow: "1 machine",
      value: thresholdLabel(machineOneThreshold.thresholdPercent, "machine"),
      body: "This is where machine queue time starts to outweigh the benefit of removing the original wristband bottleneck.",
      fill: "#eef5fd",
    },
    {
      eyebrow: "2 machines",
      value: thresholdLabel(machineTwoThreshold.thresholdPercent, "machine"),
      body: "The extra station keeps the queue short enough that the machine stays faster across the full plotted range.",
      fill: "#fff4ec",
    },
  ],
  thresholdMarkers:
    machineOneThreshold.thresholdPercent === null
      ? []
      : [
          {
            x: machineOneThreshold.thresholdPercent,
            label: `1-machine crossover`,
            color: "#2f6bb3",
            fill: "rgba(47, 107, 179, 0.12)",
          },
        ],
});

fs.writeFileSync(path.join(outputDir, "parent-compliance.svg"), `${parentSvg}\n`);
fs.writeFileSync(path.join(outputDir, "machine-threshold.svg"), `${machineSvg}\n`);
fs.writeFileSync(path.join(outputDir, "decision-dashboard.svg"), `${buildDashboardSvg()}\n`);
fs.writeFileSync(path.join(outputDir, "report.html"), `${buildReportHtml()}\n`);

buildParentCsv();
buildMachineCsv();
buildSummaryJson();

console.log("Generated static report assets:");
console.log(`- ${path.join(outputDir, "report.html")}`);
console.log(`- ${path.join(outputDir, "decision-dashboard.svg")}`);
console.log(`- ${path.join(outputDir, "parent-compliance.svg")}`);
console.log(`- ${path.join(outputDir, "machine-threshold.svg")}`);
