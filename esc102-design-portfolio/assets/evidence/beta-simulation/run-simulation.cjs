const { formatDuration, round, runAnalysis } = require("./simulation-core.js");

const results = runAnalysis({});
const machineOneRisk = results.machineDefaultRiskByCount.find(
  (item) => item.machineCount === 1,
).summary;
const machineTwoRisk = results.machineDefaultRiskByCount.find(
  (item) => item.machineCount === 2,
).summary;

function lateCopy(summary) {
  if (!summary.lateProbability && !summary.meanLateSeconds) {
    return "met the ready-by target in every simulated day";
  }

  return `missed the ready-by target in ${round(summary.lateProbability * 100, 0)}% of simulated days; average finish was ${round(
    summary.meanLateSeconds / 60,
    1,
  )}m past the target`;
}

function departureCopy(summary) {
  if (!summary.missedDepartureProbability && !summary.meanDepartureMissSeconds) {
    return "0% missed departures";
  }

  return `${round(summary.missedDepartureProbability * 100, 0)}% missed departures; average miss was ${round(
    summary.meanDepartureMissSecondsIfMissed / 60,
    1,
  )}m when a run missed`;
}

function completionCopy(summary) {
  return `end-to-end completion ${formatDuration(summary.meanCompletionSeconds)}`;
}

function requestedMetricsCopy(summary) {
  return `active staff time ${formatDuration(
    summary.meanEmployeeSeconds,
  )}; ${completionCopy(summary)}; estimated task switching ${round(
    summary.meanTaskSwitches,
    1,
  )} (2 switches per busy period); supervision interruptions ${round(
    summary.meanSupervisionInterruptions,
    1,
  )}; ${departureCopy(summary)}`;
}

console.log("Beta-Simulation default summary");
console.log("--------------------------------");
console.log(
  `Current process employee time: ${formatDuration(
    results.baseline.meanEmployeeSeconds,
  )}`,
);
console.log(
  `Current process deadline risk: ${lateCopy(results.baseline)}`,
);
console.log("");
console.log(
  `Parent default (${results.config.defaultParentCompliancePercent}% compliance, ${results.config.parentIncorrectPercent}% incorrect): ${formatDuration(
    results.parentDefaultSummary.meanEmployeeSeconds,
  )}, ${lateCopy(results.parentDefaultSummary)}`,
);
console.log(
  `Machine default (${results.config.defaultMachineStrugglePercent}% struggle, ${results.config.machineIncorrectPercent}% incorrect): ${formatDuration(
    results.machineDefaultSummary.meanEmployeeSeconds,
  )} staff time`,
);
console.log(
  `1 machine deadline risk: ${lateCopy(machineOneRisk)}`,
);
console.log(
  `2 machines deadline risk: ${lateCopy(machineTwoRisk)}`,
);
console.log("");
console.log(
  "Metric note: active staff time excludes parent effort and machine waiting, while missed departures use full end-to-end completion time.",
);
console.log(
  "Task switching is an estimate based on staffed lines going idle and then restarting; each interruption counts as two switches.",
);
console.log("");
console.log("Requested operational metrics:");
console.log(`- Current process: ${requestedMetricsCopy(results.baseline)}`);
console.log(`- Parent default: ${requestedMetricsCopy(results.parentDefaultSummary)}`);
console.log(`- 1 machine default: ${requestedMetricsCopy(machineOneRisk)}`);
console.log(`- 2 machines default: ${requestedMetricsCopy(machineTwoRisk)}`);
console.log("");
console.log("Parent break-even table:");
results.parentThresholdTable.forEach((threshold) => {
  const label =
    threshold.thresholdPercent === null
      ? "no useful region"
      : `${round(threshold.thresholdPercent, 1)}% compliance`;
  console.log(
    `- ${threshold.incorrectPercent}% incorrect: ${label}; saves ${round(
      threshold.savedMinutesAtDefault,
      1,
    )}m at 70% compliance`,
  );
});

console.log("");
console.log("Machine break-even table:");
results.machineThresholdTable.forEach((threshold) => {
  const oneMachineLabel =
    threshold.oneMachineThresholdPercent === null
      ? "no break-even"
      : threshold.oneMachineThresholdPercent >= 100
        ? "still useful at 100% struggle"
        : `${round(threshold.oneMachineThresholdPercent, 1)}% struggle`;
  const twoMachineLabel =
    threshold.twoMachineThresholdPercent === null
      ? "no break-even"
      : threshold.twoMachineThresholdPercent >= 100
        ? "still useful at 100% struggle"
        : `${round(threshold.twoMachineThresholdPercent, 1)}% struggle`;
  console.log(
    `- ${threshold.incorrectPercent}% incorrect: 1 machine ${oneMachineLabel} (saves ${round(
      threshold.savedMinutesAtDefaultOne,
      1,
    )}m at 30% struggle), 2 machines ${twoMachineLabel} (saves ${round(
      threshold.savedMinutesAtDefaultTwo,
      1,
    )}m at 30% struggle)`,
  );
});
