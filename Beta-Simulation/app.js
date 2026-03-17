(function () {
  const colors = {
    baseline: "#B54A36",
    parent: ["#2F6BB3", "#4D7A58", "#C88A2F", "#8D5A97", "#B3572F"],
    machine: ["#2F6BB3", "#4D7A58"],
    grid: "rgba(34, 32, 27, 0.12)",
    ink: "#22201B",
    muted: "#6D6558",
  };

  const inputMap = {
    children: "children",
    classrooms: "classrooms",
    arrivalWindowMinutes: "arrival-window-minutes",
    arrivalPeakBeforeDepartureMinutes: "arrival-peak-before-departure-minutes",
    arrivalSpreadMinutes: "arrival-spread-minutes",
    departureBufferMinutes: "departure-buffer-minutes",
    runs: "runs",
    baselineWristbandSeconds: "baseline-wristband-seconds",
    baselineAttendanceSeconds: "baseline-attendance-seconds",
    verifySuccessMinSeconds: "verify-success-min-seconds",
    verifySuccessMaxSeconds: "verify-success-max-seconds",
    redoSeconds: "redo-seconds",
    parentIncorrectPercent: "parent-incorrect-percent",
    machineBaseSeconds: "machine-base-seconds",
    machineExtraMinSeconds: "machine-extra-min-seconds",
    machineExtraMaxSeconds: "machine-extra-max-seconds",
    machineIncorrectPercent: "machine-incorrect-percent",
  };

  const summaryCards = document.getElementById("summary-cards");
  const thresholdTable = document.getElementById("threshold-table");
  const parentChart = document.getElementById("parent-chart");
  const machineChart = document.getElementById("machine-chart");
  const summaryStatus = document.getElementById("summary-status");
  const runButton = document.getElementById("run-button");

  function readConfig() {
    const config = {};

    Object.entries(inputMap).forEach(function assignConfig(entry) {
      const [key, elementId] = entry;
      config[key] = Number(document.getElementById(elementId).value);
    });

    return config;
  }

  function thresholdCopy(value, mode) {
    if (value === null) {
      return "No useful region in the plotted range";
    }

    if (mode === "parent") {
      if (value <= 0) {
        return "Already useful at 0% compliance";
      }

      if (value >= 100) {
        return "Needs almost full compliance";
      }

      return `Becomes useful at about ${BetaSimulation.round(value, 1)}% compliance`;
    }

    if (value >= 100) {
      return "Still useful even if every parent struggles";
    }

    return `Useful until about ${BetaSimulation.round(value, 1)}% struggle`;
  }

  function lateCopy(summary) {
    if (!summary.lateProbability && !summary.meanLateSeconds) {
      return "Met the ready-by target in every simulated day";
    }

    return `Missed the ready-by target in ${BetaSimulation.round(summary.lateProbability * 100, 0)}% of simulated days. Average finish was ${BetaSimulation.round(
      summary.meanLateSeconds / 60,
      1,
    )}m past the target.`;
  }

  function renderSummary(results) {
    const parentBest = results.parentThresholds[0];
    const machineOne = results.machineThresholds.find(function find(machine) {
      return machine.machineCount === 1;
    });
    const machineTwo = results.machineThresholds.find(function find(machine) {
      return machine.machineCount === 2;
    });

    const cards = [
      {
        title: "Current Process",
        value: BetaSimulation.formatDuration(results.parentEmployeeBaselineSeconds),
        body: `Employee time for the current process. ${lateCopy(results.baseline)}.`,
      },
      {
        title: "Parent Model",
        value: thresholdCopy(parentBest.thresholdPercent, "parent"),
        body: `Employee time only: 5 seconds per child if compliant, plus 25 extra seconds for each missed or incorrect wristband. ${lateCopy(results.parentDefaultSummary)}.`,
      },
      {
        title: "Machine Model",
        value: `1 machine: ${thresholdCopy(
          machineOne.thresholdPercent,
          "machine",
        )}`,
        body: `2 machines: ${thresholdCopy(machineTwo.thresholdPercent, "machine")}. With 2 machines, lighter crowding reduces failure conversion as well as deadline risk.`,
      },
    ];

    summaryCards.innerHTML = cards
      .map(function buildCard(card) {
        return `
          <article class="summary-card">
            <h3>${card.title}</h3>
            <strong>${card.value}</strong>
            <p>${card.body}</p>
          </article>
        `;
      })
      .join("");

    thresholdTable.innerHTML = `
      <div class="threshold-block">
        <h3>Parent compliance threshold</h3>
        <div class="threshold-list">
          ${results.parentThresholds
            .map(function item(threshold) {
              return `
                <div class="threshold-item">
                  <span>${threshold.label}</span>
                  <strong>${thresholdCopy(threshold.thresholdPercent, "parent")}</strong>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
      <div class="threshold-block">
        <h3>Machine employee-time threshold at ${results.config.machineIncorrectPercent}% incorrect application</h3>
        <div class="threshold-list">
          ${results.machineThresholds
            .map(function item(threshold) {
              return `
                <div class="threshold-item">
                  <span>${threshold.machineCount} machine${threshold.machineCount === 1 ? "" : "s"}</span>
                  <strong>${thresholdCopy(threshold.thresholdPercent, "machine")}</strong>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderChart(container, options) {
    if (!options.series.length) {
      container.innerHTML = '<div class="empty-chart">No data available.</div>';
      return;
    }

    const width = 640;
    const height = 420;
    const margin = { top: 28, right: 20, bottom: 48, left: 62 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const allPoints = [];
    options.series.forEach(function collectSeries(series) {
      series.data.forEach(function collectPoint(point) {
        allPoints.push(point);
      });
    });

    const xMin = options.xMin;
    const xMax = options.xMax;
    const yMin = Math.min(
      options.baselineY,
      ...allPoints.map(function byY(point) {
        return point.y;
      }),
    );
    const yMax = Math.max(
      options.baselineY,
      ...allPoints.map(function byY(point) {
        return point.y;
      }),
    );
    const paddedYMin = Math.max(0, yMin - (yMax - yMin) * 0.08);
    const paddedYMax = yMax + (yMax - yMin || 1) * 0.12;

    function scaleX(value) {
      return (
        margin.left + ((value - xMin) / Math.max(1, xMax - xMin)) * innerWidth
      );
    }

    function scaleY(value) {
      return (
        margin.top +
        innerHeight -
        ((value - paddedYMin) / Math.max(1, paddedYMax - paddedYMin)) * innerHeight
      );
    }

    const yTicks = 5;
    const xTicks = 5;

    const gridLines = [];
    for (let tick = 0; tick <= yTicks; tick += 1) {
      const value = paddedYMin + ((paddedYMax - paddedYMin) / yTicks) * tick;
      const y = scaleY(value);
      gridLines.push(`
        <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="${colors.grid}" />
        <text class="tick-label" x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="12">
          ${BetaSimulation.round(value / 60, 1)}m
        </text>
      `);
    }

    for (let tick = 0; tick <= xTicks; tick += 1) {
      const value = xMin + ((xMax - xMin) / xTicks) * tick;
      const x = scaleX(value);
      gridLines.push(`
        <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="${colors.grid}" />
        <text class="tick-label" x="${x}" y="${height - margin.bottom + 22}" text-anchor="middle" font-size="12">
          ${BetaSimulation.round(value, 0)}%
        </text>
      `);
    }

    const seriesPaths = options.series
      .map(function drawSeries(series, index) {
        const band = series.data.some(function anyBand(point) {
          return typeof point.low === "number" && typeof point.high === "number";
        })
          ? `
            <polygon
              points="${[
                ...series.data.map(function upper(point) {
                  return `${scaleX(point.x)},${scaleY(point.high)}`;
                }),
                ...series.data
                  .slice()
                  .reverse()
                  .map(function lower(point) {
                    return `${scaleX(point.x)},${scaleY(point.low)}`;
                  }),
              ].join(" ")}"
              fill="${options.bandFills ? options.bandFills[index % options.bandFills.length] : "rgba(47,107,179,0.12)"}"
              stroke="none"
            />
          `
          : "";
        const path = series.data
          .map(function point(point, pointIndex) {
            const x = scaleX(point.x);
            const y = scaleY(point.y);
            return `${pointIndex === 0 ? "M" : "L"} ${x} ${y}`;
          })
          .join(" ");

        const color = options.colors[index % options.colors.length];
        return `
          ${band}
          <path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${series.strokeDasharray || ""}" stroke-linejoin="round" stroke-linecap="round" />
        `;
      })
      .join("");

    const baselineY = scaleY(options.baselineY);
    const legend = options.series
      .map(function legendItem(series, index) {
        const y = margin.top + index * 22;
        const color = options.colors[index % options.colors.length];
        return `
          <line x1="${width - 180}" y1="${y + 4}" x2="${width - 156}" y2="${y + 4}" stroke="${color}" stroke-width="3" stroke-dasharray="${series.strokeDasharray || ""}" />
          <text class="legend-text" x="${width - 148}" y="${y + 8}" font-size="12">
            ${series.label}
          </text>
        `;
      })
      .join("");

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.title}">
        <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.62)" />
        ${gridLines.join("")}
        <line
          x1="${margin.left}"
          y1="${baselineY}"
          x2="${width - margin.right}"
          y2="${baselineY}"
          stroke="${colors.baseline}"
          stroke-width="2"
          stroke-dasharray="8 6"
        />
        <text x="${width - margin.right}" y="${baselineY - 8}" fill="${colors.baseline}" font-size="12" text-anchor="end">
          Current process
        </text>
        ${seriesPaths}
        <text class="axis-label" x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="12">
          ${options.xLabel}
        </text>
        <text
          class="axis-label"
          x="18"
          y="${height / 2}"
          text-anchor="middle"
          font-size="12"
          transform="rotate(-90 18 ${height / 2})"
        >
          ${options.yLabel || "Total completion time"}
        </text>
        ${legend}
      </svg>
    `;
  }

  function run() {
    summaryStatus.textContent = "Running simulation...";
    runButton.disabled = true;

    window.requestAnimationFrame(function compute() {
      const config = readConfig();
      const results = BetaSimulation.runAnalysis(config);

      renderSummary(results);
      renderChart(parentChart, {
        title: "Parent compliance threshold chart",
        series: results.parentSeries,
        baselineY: results.parentEmployeeBaselineSeconds,
        xMin: 0,
        xMax: 100,
        xLabel: "Parent compliance",
        yLabel: "Employee time",
        colors: colors.parent,
        bandFills: ["rgba(47,107,179,0.16)"],
      });
      renderChart(machineChart, {
        title: "Machine usefulness threshold chart",
        series: results.machineSeries.map(function styleSeries(series, index) {
          return index === 1
            ? Object.assign({}, series, { strokeDasharray: "10 6" })
            : series;
        }),
        baselineY: results.parentEmployeeBaselineSeconds,
        xMin: 0,
        xMax: 100,
        xLabel: "Parents who struggle at the machine",
        yLabel: "Employee time",
        colors: colors.machine,
        bandFills: ["rgba(47,107,179,0.16)", "rgba(77,122,88,0.1)"],
      });

      const machineLateRisk = results.machineDefaultRiskByCount.find(function find(item) {
        return item.machineCount === 2;
      }).summary;

      summaryStatus.textContent = `Current-process employee time: ${BetaSimulation.formatDuration(
        results.parentEmployeeBaselineSeconds,
      )}. Parent break-even is about ${BetaSimulation.round(
        results.parentThresholds[0].thresholdPercent,
        1,
      )}% compliance, machine break-even is about ${BetaSimulation.round(
        results.machineThresholds.find(function find(item) {
          return item.machineCount === 1;
        }).thresholdPercent,
        1,
      )}% struggle for 1 machine, and the 2-machine default case ${lateCopy(machineLateRisk)}`;
      runButton.disabled = false;
    });
  }

  runButton.addEventListener("click", run);
  run();
})();
