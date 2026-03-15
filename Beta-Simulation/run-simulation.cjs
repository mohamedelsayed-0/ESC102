const { formatDuration, round, runAnalysis } = require("./simulation-core.js");

const results = runAnalysis({
});

console.log("Beta-Simulation default summary");
console.log("--------------------------------");
console.log(
  `Current process average completion: ${formatDuration(
    results.baseline.meanCompletionSeconds,
  )}`,
);
console.log("");
console.log(
  `Current process employee time: ${formatDuration(
    results.parentEmployeeBaselineSeconds,
  )}`,
);
console.log("");
console.log("Parent compliance threshold:");

results.parentThresholds.forEach((threshold) => {
  const label =
    threshold.thresholdPercent === null
      ? "no useful region in plotted range"
      : threshold.thresholdPercent <= 0
        ? "already useful at 0% compliance"
        : `${round(threshold.thresholdPercent, 1)}% compliance`;
  console.log(`- ${threshold.label}: ${label}`);
});

console.log("");
console.log("Machine struggle thresholds:");

results.machineThresholds.forEach((threshold) => {
  const label =
    threshold.thresholdPercent === null
      ? "not useful at 0% struggle"
      : threshold.thresholdPercent >= 100
        ? "still useful at 100% struggle"
        : `${round(threshold.thresholdPercent, 1)}% struggle`;
  console.log(`- ${threshold.machineCount} machine(s): ${label}`);
});
