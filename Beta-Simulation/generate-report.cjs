const fs = require("fs");
const path = require("path");
const { formatDuration, round, runAnalysis } = require("./simulation-core.js");

const outputDir = path.join(__dirname, "outputs");
const results = runAnalysis({});

fs.mkdirSync(outputDir, { recursive: true });

function escapeHtml(value) {
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
    return "No useful region in plotted range";
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
        round(series.incorrectPercent, 0),
        round(point.y, 3),
        durationMinutes(point.y),
      ]);
    });
  });

  writeCsv(
    "parent-compliance.csv",
    [
      "compliance_percent",
      "incorrect_application_percent",
      "mean_completion_seconds",
      "mean_completion_minutes",
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
    parentThresholds: results.parentThresholds.map((item) => ({
      incorrectPercent: round(item.incorrectPercent, 0),
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

function renderLineChart(options) {
  const width = 1400;
  const height = 920;
  const margin = { top: 130, right: 90, bottom: 120, left: 120 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const bounds = getSeriesBounds(options.series, options.baselineY);
  const theme = {
    backgroundTop: "#fbf5eb",
    backgroundBottom: "#f2eadc",
    card: "#fffdf8",
    ink: "#221f1a",
    muted: "#6f6559",
    grid: "rgba(34, 31, 26, 0.12)",
    baseline: "#b54a36",
  };

  function xScale(value) {
    return (
      margin.left + ((value - options.xMin) / (options.xMax - options.xMin)) * chartWidth
    );
  }

  function yScale(value) {
    return (
      margin.top +
      chartHeight -
      ((value - bounds.min) / (bounds.max - bounds.min || 1)) * chartHeight
    );
  }

  const yTicks = 6;
  const xTicks = 5;
  const grid = [];

  for (let i = 0; i <= yTicks; i += 1) {
    const value = bounds.min + ((bounds.max - bounds.min) / yTicks) * i;
    const y = yScale(value);
    grid.push(`
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="${theme.grid}" />
      <text x="${margin.left - 18}" y="${y + 5}" text-anchor="end" font-size="22" fill="${theme.muted}" font-family="Avenir Next, Segoe UI, sans-serif">
        ${round(value / 60, 1)}m
      </text>
    `);
  }

  for (let i = 0; i <= xTicks; i += 1) {
    const value = options.xMin + ((options.xMax - options.xMin) / xTicks) * i;
    const x = xScale(value);
    grid.push(`
      <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="${theme.grid}" />
      <text x="${x}" y="${height - margin.bottom + 38}" text-anchor="middle" font-size="22" fill="${theme.muted}" font-family="Avenir Next, Segoe UI, sans-serif">
        ${round(value, 0)}%
      </text>
    `);
  }

  const paths = options.series
    .map((line, index) => {
      const path = line.data
        .map((point, pointIndex) => {
          const x = xScale(point.x);
          const y = yScale(point.y);
          return `${pointIndex === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

      return `<path d="${path}" fill="none" stroke="${options.colors[index % options.colors.length]}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />`;
    })
    .join("");

  const legend = options.series
    .map((line, index) => {
      const x = margin.left + index * 220;
      const y = 72;
      return `
        <line x1="${x}" y1="${y}" x2="${x + 44}" y2="${y}" stroke="${options.colors[index % options.colors.length]}" stroke-width="6" />
        <text x="${x + 56}" y="${y + 7}" font-size="22" fill="${theme.muted}" font-family="Avenir Next, Segoe UI, sans-serif">
          ${escapeHtml(line.label)}
        </text>
      `;
    })
    .join("");

  const noteLines = options.notes
    .map(
      (line, index) => `
        <text x="${width - 420}" y="${186 + index * 32}" font-size="21" fill="${theme.muted}" font-family="Avenir Next, Segoe UI, sans-serif">
          ${escapeHtml(line)}
        </text>
      `,
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${theme.backgroundTop}" />
          <stop offset="100%" stop-color="${theme.backgroundBottom}" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#674b2d" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="36" fill="url(#bg)" />
      <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="30" fill="${theme.card}" filter="url(#shadow)" />
      <text x="${margin.left}" y="76" font-size="46" fill="${theme.ink}" font-family="Iowan Old Style, Palatino Linotype, serif" font-weight="700">
        ${escapeHtml(options.title)}
      </text>
      <text x="${margin.left}" y="112" font-size="24" fill="${theme.muted}" font-family="Avenir Next, Segoe UI, sans-serif">
        ${escapeHtml(options.subtitle)}
      </text>
      ${legend}
      <rect x="${width - 444}" y="132" width="330" height="${108 + options.notes.length * 4}" rx="22" fill="rgba(47, 107, 179, 0.06)" />
      ${noteLines}
      ${grid.join("")}
      <line x1="${margin.left}" y1="${yScale(options.baselineY)}" x2="${width - margin.right}" y2="${yScale(options.baselineY)}" stroke="${theme.baseline}" stroke-width="4" stroke-dasharray="14 12" />
      <text x="${width - margin.right}" y="${yScale(options.baselineY) - 12}" text-anchor="end" font-size="22" fill="${theme.baseline}" font-family="Avenir Next, Segoe UI, sans-serif" font-weight="700">
        Current process: ${formatDuration(options.baselineY)}
      </text>
      ${paths}
      <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="24" fill="${theme.muted}" font-family="Avenir Next, Segoe UI, sans-serif">
        ${escapeHtml(options.xLabel)}
      </text>
      <text x="40" y="${height / 2}" text-anchor="middle" font-size="24" fill="${theme.muted}" font-family="Avenir Next, Segoe UI, sans-serif" transform="rotate(-90 40 ${height / 2})">
        Average total completion time
      </text>
    </svg>
  `.trim();
}

function buildDashboardSvg() {
  const width = 1600;
  const height = 900;
  const baseline = formatDuration(results.baseline.meanCompletionSeconds);
  const machineOne = results.machineThresholds.find((item) => item.machineCount === 1);
  const machineTwo = results.machineThresholds.find((item) => item.machineCount === 2);
  const parentWorst = results.parentThresholds[results.parentThresholds.length - 1];

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="hero" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#fcf7ef" />
          <stop offset="100%" stop-color="#f0e4d0" />
        </linearGradient>
        <linearGradient id="accent" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#b3572f" />
          <stop offset="100%" stop-color="#d48752" />
        </linearGradient>
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="26" flood-color="#573e2c" flood-opacity="0.12" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" rx="42" fill="url(#hero)" />
      <rect x="48" y="48" width="${width - 96}" height="${height - 96}" rx="34" fill="#fffdf8" filter="url(#cardShadow)" />
      <rect x="92" y="92" width="510" height="252" rx="32" fill="url(#accent)" />
      <text x="134" y="152" font-size="24" fill="#f9eadf" font-family="Avenir Next, Segoe UI, sans-serif" letter-spacing="4">
        ESC102 / DAYCARE PROTOTYPE
      </text>
      <text x="134" y="220" font-size="64" fill="#fffaf5" font-family="Iowan Old Style, Palatino Linotype, serif" font-weight="700">
        Wristband
      </text>
      <text x="134" y="288" font-size="64" fill="#fffaf5" font-family="Iowan Old Style, Palatino Linotype, serif" font-weight="700">
        Simulation
      </text>
      <text x="672" y="150" font-size="28" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif">
        Decision metric: total time until every child is ready for departure.
      </text>
      <text x="672" y="198" font-size="28" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif">
        Default model: 90 children, 10 classrooms, normal arrival pattern.
      </text>
      <rect x="92" y="394" width="438" height="184" rx="28" fill="#fff6ef" />
      <rect x="580" y="394" width="438" height="184" rx="28" fill="#eef5fd" />
      <rect x="1068" y="394" width="438" height="184" rx="28" fill="#edf6ee" />
      <text x="128" y="444" font-size="22" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif" letter-spacing="2">
        CURRENT PROCESS
      </text>
      <text x="128" y="518" font-size="54" fill="#221f1a" font-family="Iowan Old Style, Palatino Linotype, serif" font-weight="700">
        ${baseline}
      </text>
      <text x="128" y="556" font-size="24" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif">
        One employee handles wristbands before classroom attendance.
      </text>
      <text x="616" y="444" font-size="22" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif" letter-spacing="2">
        PARENT MODEL
      </text>
      <text x="616" y="516" font-size="40" fill="#221f1a" font-family="Iowan Old Style, Palatino Linotype, serif" font-weight="700">
        ${thresholdLabel(parentWorst.thresholdPercent, "parent")}
      </text>
      <text x="616" y="556" font-size="24" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif">
        Even the worst plotted line (${round(parentWorst.incorrectPercent, 0)}% incorrect) beats baseline.
      </text>
      <text x="1104" y="444" font-size="22" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif" letter-spacing="2">
        MACHINE MODEL
      </text>
      <text x="1104" y="500" font-size="34" fill="#221f1a" font-family="Iowan Old Style, Palatino Linotype, serif" font-weight="700">
        1 machine: ${thresholdLabel(machineOne.thresholdPercent, "machine")}
      </text>
      <text x="1104" y="548" font-size="34" fill="#221f1a" font-family="Iowan Old Style, Palatino Linotype, serif" font-weight="700">
        2 machines: ${thresholdLabel(machineTwo.thresholdPercent, "machine")}
      </text>
      <text x="92" y="670" font-size="28" fill="#221f1a" font-family="Iowan Old Style, Palatino Linotype, serif" font-weight="700">
        Interpretation
      </text>
      <text x="92" y="720" font-size="26" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif">
        Parent-applied wristbands stay faster because the remaining checks are distributed across classrooms instead of bottlenecking at one staff member.
      </text>
      <text x="92" y="764" font-size="26" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif">
        The machine stays competitive as long as the queue it creates is smaller than the original single-employee wristband bottleneck.
      </text>
      <text x="92" y="808" font-size="26" fill="#6f6559" font-family="Avenir Next, Segoe UI, sans-serif">
        Use the interactive simulator to change arrival window, timing assumptions, and error rates.
      </text>
    </svg>
  `.trim();
}

function buildReportHtml() {
  const parentRows = results.parentThresholds
    .map(
      (item) => `
        <tr>
          <td>${round(item.incorrectPercent, 0)}%</td>
          <td>${escapeHtml(thresholdLabel(item.thresholdPercent, "parent"))}</td>
        </tr>
      `,
    )
    .join("");

  const machineRows = results.machineThresholds
    .map(
      (item) => `
        <tr>
          <td>${item.machineCount}</td>
          <td>${escapeHtml(thresholdLabel(item.thresholdPercent, "machine"))}</td>
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
              <span class="muted">Current process average</span>
              <strong>${formatDuration(results.baseline.meanCompletionSeconds)}</strong>
              <p class="muted">
                Assumptions: ${results.config.children} children, ${results.config.classrooms} classrooms,
                ${results.config.arrivalWindowMinutes}-minute normal arrival window, and ${results.config.runs} Monte Carlo runs per point.
              </p>
            </div>
          </section>

          <section class="panel wide">
            <h2>Decision Summary</h2>
            <div class="cards">
              <article class="card">
                <h3>Parent model</h3>
                <strong>${escapeHtml(thresholdLabel(results.parentThresholds[0].thresholdPercent, "parent"))}</strong>
                <p class="muted">Across the plotted 0% to ${results.config.parentIncorrectMaxPercent}% incorrect range, the parent-applied model stays under the baseline.</p>
              </article>
              <article class="card">
                <h3>1 machine</h3>
                <strong>${escapeHtml(thresholdLabel(results.machineThresholds[0].thresholdPercent, "machine"))}</strong>
                <p class="muted">This is the approximate struggle-rate limit before the machine queue becomes slower than the current process.</p>
              </article>
              <article class="card">
                <h3>2 machines</h3>
                <strong>${escapeHtml(thresholdLabel(results.machineThresholds[1].thresholdPercent, "machine"))}</strong>
                <p class="muted">With two machines, the queue effect stays weak enough that the machine remains faster across the full plotted range.</p>
              </article>
            </div>
          </section>

          <div class="grid" style="margin-top: 18px;">
            <section class="panel half">
              <h2>Parent Threshold Table</h2>
              <table>
                <thead>
                  <tr><th>Incorrect application rate</th><th>Useful region</th></tr>
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
    "Lower lines are better. The dashed line is the current process. Compliance moves left to right.",
  xLabel: "Parent compliance before entering the classroom",
  xMin: 0,
  xMax: 100,
  baselineY: results.baseline.meanCompletionSeconds,
  series: results.parentSeries,
  colors: ["#2f6bb3", "#4d7a58", "#c88a2f", "#8d5a97", "#b3572f"],
  notes: [
    `Baseline: ${formatDuration(results.baseline.meanCompletionSeconds)}`,
    `Incorrect range: 0% to ${results.config.parentIncorrectMaxPercent}%`,
    "All plotted parent-model lines remain below baseline",
  ],
});

const machineSvg = renderLineChart({
  title: "Machine Threshold",
  subtitle:
    "Lower lines are better. The dashed line is the current process. Struggle rate moves left to right.",
  xLabel: "Parents who struggle and need extra machine time",
  xMin: 0,
  xMax: 100,
  baselineY: results.baseline.meanCompletionSeconds,
  series: results.machineSeries,
  colors: ["#2f6bb3", "#4d7a58"],
  notes: [
    `Machine base time: ${results.config.machineBaseSeconds}s`,
    "Extra delay if struggling: 5 to 15 seconds",
    `1 machine crosses baseline near ${round(results.machineThresholds[0].thresholdPercent, 1)}%`,
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
