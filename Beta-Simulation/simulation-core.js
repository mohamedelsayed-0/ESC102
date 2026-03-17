(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.BetaSimulation = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const defaultConfig = {
    children: 90,
    classrooms: 10,
    arrivalWindowMinutes: 30,
    arrivalPeakBeforeDepartureMinutes: 9,
    arrivalSpreadMinutes: 3.5,
    departureBufferMinutes: 5,
    rushWindowMinutes: 10,
    runs: 400,
    baselineWristbandSeconds: 20,
    baselineAttendanceSeconds: 3,
    verifySuccessMinSeconds: 3,
    verifySuccessMaxSeconds: 5,
    redoSeconds: 25,
    parentIncorrectPercent: 20,
    machineBaseSeconds: 12,
    machineExtraMinSeconds: 5,
    machineExtraMaxSeconds: 15,
    machineIncorrectPercent: 20,
    complianceStepPercent: 5,
    struggleStepPercent: 5,
    defaultParentCompliancePercent: 70,
    defaultMachineStrugglePercent: 30,
    parentIncorrectSweep: [10, 20, 30, 40],
    machineIncorrectSweep: [10, 20, 30, 40],
    parentRushCompliancePenaltyPercent: 25,
    parentRushIncorrectLiftPercent: 15,
    machineRushStruggleLiftPercent: 20,
    machineRushIncorrectLiftPercent: 10,
    machineStruggleIncorrectLiftPercent: 60,
    machineTwoIncorrectReductionPercent: 15,
    machineTwoStruggleFailureReductionPercent: 35,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
  }

  function createRng(seed) {
    let state = seed >>> 0;
    return function rng() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalSample(rng) {
    let u = 0;
    let v = 0;

    while (u === 0) {
      u = rng();
    }
    while (v === 0) {
      v = rng();
    }

    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sampleTruncatedNormal(rng, mean, stdDev, min, max) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const sample = mean + normalSample(rng) * stdDev;
      if (sample >= min && sample <= max) {
        return sample;
      }
    }

    return clamp(mean + normalSample(rng) * stdDev, min, max);
  }

  function sampleUniform(rng, min, max) {
    return min + rng() * (max - min);
  }

  function average(values) {
    if (!values.length) {
      return 0;
    }

    return values.reduce(function sum(total, value) {
      return total + value;
    }, 0) / values.length;
  }

  function percentile(values, ratio) {
    if (!values.length) {
      return 0;
    }

    const sorted = values.slice().sort(function byValue(a, b) {
      return a - b;
    });
    const index = (sorted.length - 1) * clamp(ratio, 0, 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);

    if (lowerIndex === upperIndex) {
      return sorted[lowerIndex];
    }

    const remainder = index - lowerIndex;
    return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * remainder;
  }

  function buildPercentRange(stepPercent) {
    const range = [];
    for (let value = 0; value <= 100; value += stepPercent) {
      range.push(value);
    }

    if (range[range.length - 1] !== 100) {
      range.push(100);
    }

    return range;
  }

  function normalizeSweep(values, fallback) {
    const source = Array.isArray(values) && values.length ? values : fallback;
    const unique = Array.from(
      new Set(
        source
          .map(function toNumber(value) {
            return clamp(Math.round(Number(value) || 0), 0, 100);
          })
          .filter(function keep(value) {
            return Number.isFinite(value);
          }),
      ),
    );

    unique.sort(function byValue(a, b) {
      return a - b;
    });

    return unique.length ? unique : fallback.slice();
  }

  function makeFailureCounts(initialCounts) {
    return Object.assign({}, initialCounts);
  }

  function addFailureCount(counts, key) {
    counts[key] = (counts[key] || 0) + 1;
  }

  function getArrivalWindowSeconds(config) {
    return config.arrivalWindowMinutes * 60;
  }

  function getReadyDeadlineSeconds(config) {
    return Math.max(
      0,
      getArrivalWindowSeconds(config) - config.departureBufferMinutes * 60,
    );
  }

  function getRushPressure(config, arrivalSeconds) {
    const deadlineSeconds = getReadyDeadlineSeconds(config);
    const rushStartSeconds = Math.max(
      0,
      deadlineSeconds - config.rushWindowMinutes * 60,
    );

    if (arrivalSeconds <= rushStartSeconds) {
      return 0;
    }

    if (arrivalSeconds >= deadlineSeconds) {
      return 1;
    }

    return (
      (arrivalSeconds - rushStartSeconds)
      / Math.max(1, deadlineSeconds - rushStartSeconds)
    );
  }

  function buildChildren(config, rng) {
    const arrivalWindowSeconds = getArrivalWindowSeconds(config);
    const meanArrival = clamp(
      arrivalWindowSeconds - config.arrivalPeakBeforeDepartureMinutes * 60,
      0,
      arrivalWindowSeconds,
    );
    const stdArrival = Math.max(60, config.arrivalSpreadMinutes * 60);
    const children = [];

    for (let index = 0; index < config.children; index += 1) {
      const arrival = sampleTruncatedNormal(
        rng,
        meanArrival,
        stdArrival,
        0,
        arrivalWindowSeconds,
      );

      children.push({
        arrival,
        classroom: index % config.classrooms,
        rushPressure: getRushPressure(config, arrival),
      });
    }

    children.sort(function byArrival(a, b) {
      return a.arrival - b.arrival;
    });

    return children;
  }

  function summarizeRuns(runResults, deadlineSeconds) {
    const employeeSeconds = runResults.map(function collect(run) {
      return run.totalEmployeeSeconds;
    });
    const completionSeconds = runResults.map(function collect(run) {
      return run.totalCompletionSeconds;
    });
    const lateSeconds = completionSeconds.map(function lateness(value) {
      return Math.max(0, value - deadlineSeconds);
    });
    const lateOnly = lateSeconds.filter(function keep(value) {
      return value > 0;
    });
    const failureKeys = Array.from(
      new Set(
        runResults.flatMap(function collect(run) {
          return Object.keys(run.failureCounts || {});
        }),
      ),
    );
    const meanFailureCounts = {};

    failureKeys.forEach(function buildMean(key) {
      meanFailureCounts[key] = average(
        runResults.map(function count(run) {
          return (run.failureCounts && run.failureCounts[key]) || 0;
        }),
      );
    });

    return {
      meanEmployeeSeconds: average(employeeSeconds),
      p10EmployeeSeconds: percentile(employeeSeconds, 0.1),
      p90EmployeeSeconds: percentile(employeeSeconds, 0.9),
      meanCompletionSeconds: average(completionSeconds),
      p90CompletionSeconds: percentile(completionSeconds, 0.9),
      meanLateSeconds: average(lateSeconds),
      lateProbability: lateOnly.length / Math.max(1, runResults.length),
      meanLateSecondsIfLate: average(lateOnly),
      p90LateSeconds: percentile(lateOnly, 0.9),
      meanFailureCounts,
    };
  }

  function collectScenarioRuns(config, seedOffset, runner) {
    const results = [];
    const deadlineSeconds = getReadyDeadlineSeconds(config);

    for (let runIndex = 0; runIndex < config.runs; runIndex += 1) {
      const rng = createRng(seedOffset + runIndex * 97);
      results.push(runner(config, rng, runIndex));
    }

    return summarizeRuns(results, deadlineSeconds);
  }

  function simulateBaseline(config, rng) {
    const children = buildChildren(config, rng);
    let wristbandAvailableAt = 0;
    const classroomAvailableAt = Array(config.classrooms).fill(0);
    let totalCompletionSeconds = 0;
    let totalEmployeeSeconds = 0;

    for (const child of children) {
      const wristbandTime = sampleTruncatedNormal(
        rng,
        config.baselineWristbandSeconds,
        Math.max(1, config.baselineWristbandSeconds * 0.18),
        Math.max(1, config.baselineWristbandSeconds * 0.4),
        config.baselineWristbandSeconds * 1.7,
      );
      const wristbandStart = Math.max(child.arrival, wristbandAvailableAt);
      const wristbandDone = wristbandStart + wristbandTime;
      wristbandAvailableAt = wristbandDone;

      const classroomIndex = child.classroom;
      const attendanceStart = Math.max(
        wristbandDone,
        classroomAvailableAt[classroomIndex],
      );
      const attendanceDone =
        attendanceStart + config.baselineAttendanceSeconds;
      classroomAvailableAt[classroomIndex] = attendanceDone;

      totalCompletionSeconds = Math.max(totalCompletionSeconds, attendanceDone);
      totalEmployeeSeconds += wristbandTime + config.baselineAttendanceSeconds;
    }

    return {
      totalCompletionSeconds,
      totalEmployeeSeconds,
      failureCounts: makeFailureCounts({}),
    };
  }

  function simulateParentScenario(config, rng, complianceRate, incorrectRate) {
    const children = buildChildren(config, rng);
    const classroomAvailableAt = Array(config.classrooms).fill(0);
    let totalCompletionSeconds = 0;
    let totalEmployeeSeconds = 0;
    const failureCounts = makeFailureCounts({
      success: 0,
      nonCompliant: 0,
      incorrectApplied: 0,
    });

    for (const child of children) {
      const effectiveCompliance = clamp(
        complianceRate
          - child.rushPressure * (config.parentRushCompliancePenaltyPercent / 100),
        0,
        1,
      );
      const effectiveIncorrect = clamp(
        incorrectRate
          + child.rushPressure * (config.parentRushIncorrectLiftPercent / 100),
        0,
        1,
      );
      const applied = rng() < effectiveCompliance;
      const successful = applied && rng() >= effectiveIncorrect;
      const checkSeconds = sampleUniform(
        rng,
        config.verifySuccessMinSeconds,
        config.verifySuccessMaxSeconds,
      );
      const employeeSeconds = successful
        ? checkSeconds
        : checkSeconds + config.redoSeconds;
      const classroomIndex = child.classroom;
      const serviceStart = Math.max(
        child.arrival,
        classroomAvailableAt[classroomIndex],
      );
      const serviceDone = serviceStart + employeeSeconds;

      classroomAvailableAt[classroomIndex] = serviceDone;
      totalCompletionSeconds = Math.max(totalCompletionSeconds, serviceDone);
      totalEmployeeSeconds += employeeSeconds;

      if (successful) {
        addFailureCount(failureCounts, "success");
      } else if (!applied) {
        addFailureCount(failureCounts, "nonCompliant");
      } else {
        addFailureCount(failureCounts, "incorrectApplied");
      }
    }

    return {
      totalCompletionSeconds,
      totalEmployeeSeconds,
      failureCounts,
    };
  }

  function simulateMachineScenario(
    config,
    rng,
    machineCount,
    struggleRate,
    incorrectRate,
  ) {
    const children = buildChildren(config, rng);
    const machineAvailableAt = Array(machineCount).fill(0);
    const classroomAvailableAt = Array(config.classrooms).fill(0);
    let totalCompletionSeconds = 0;
    let totalEmployeeSeconds = 0;
    const failureCounts = makeFailureCounts({
      success: 0,
      struggleRedo: 0,
      incorrectAfterMachine: 0,
    });

    for (const child of children) {
      let chosenMachine = 0;

      for (let index = 1; index < machineAvailableAt.length; index += 1) {
        if (machineAvailableAt[index] < machineAvailableAt[chosenMachine]) {
          chosenMachine = index;
        }
      }

      const effectiveStruggle = clamp(
        struggleRate
          + child.rushPressure * (config.machineRushStruggleLiftPercent / 100),
        0,
        1,
      );
      const struggled = rng() < effectiveStruggle;
      const struggleExtra = struggled
        ? sampleUniform(
            rng,
            config.machineExtraMinSeconds,
            config.machineExtraMaxSeconds,
          )
        : 0;
      const machineStart = Math.max(child.arrival, machineAvailableAt[chosenMachine]);
      const machineDone = machineStart + config.machineBaseSeconds + struggleExtra;
      machineAvailableAt[chosenMachine] = machineDone;

      const twoMachineIncorrectReductionFactor =
        machineCount >= 2
          ? 1 - config.machineTwoIncorrectReductionPercent / 100
          : 1;
      const strugglePenaltyFactor =
        machineCount >= 2
          ? 1 - config.machineTwoStruggleFailureReductionPercent / 100
          : 1;
      const effectiveIncorrect = clamp(
        (
          incorrectRate
          + child.rushPressure * (config.machineRushIncorrectLiftPercent / 100)
        ) * twoMachineIncorrectReductionFactor
          + (
            struggled
              ? (config.machineStruggleIncorrectLiftPercent / 100) * strugglePenaltyFactor
              : 0
          ),
        0,
        1,
      );
      const successful = rng() >= effectiveIncorrect;
      const checkSeconds = sampleUniform(
        rng,
        config.verifySuccessMinSeconds,
        config.verifySuccessMaxSeconds,
      );
      const employeeSeconds = successful
        ? checkSeconds
        : checkSeconds + config.redoSeconds;
      const classroomIndex = child.classroom;
      const classroomStart = Math.max(
        machineDone,
        classroomAvailableAt[classroomIndex],
      );
      const classroomDone = classroomStart + employeeSeconds;

      classroomAvailableAt[classroomIndex] = classroomDone;
      totalCompletionSeconds = Math.max(totalCompletionSeconds, classroomDone);
      totalEmployeeSeconds += employeeSeconds;

      if (successful) {
        addFailureCount(failureCounts, "success");
      } else if (struggled) {
        addFailureCount(failureCounts, "struggleRedo");
      } else {
        addFailureCount(failureCounts, "incorrectAfterMachine");
      }
    }

    return {
      totalCompletionSeconds,
      totalEmployeeSeconds,
      failureCounts,
    };
  }

  function toBandSeries(label, points, extra) {
    return Object.assign(
      {
        label,
        data: points.map(function point(item) {
          return {
            x: item.x,
            y: item.summary.meanEmployeeSeconds,
            low: item.summary.p10EmployeeSeconds,
            high: item.summary.p90EmployeeSeconds,
            lateProbability: item.summary.lateProbability,
          };
        }),
      },
      extra || {},
    );
  }

  function interpolateCrossing(x1, y1, x2, y2, target) {
    if (y1 === y2) {
      return x1;
    }

    const slope = (y2 - y1) / (x2 - x1);
    return x1 + (target - y1) / slope;
  }

  function findParentThreshold(series, baselineSeconds) {
    if (!series.data.length) {
      return null;
    }

    if (series.data[0].y <= baselineSeconds) {
      return 0;
    }

    for (let index = 1; index < series.data.length; index += 1) {
      const previous = series.data[index - 1];
      const current = series.data[index];

      if (current.y <= baselineSeconds) {
        return interpolateCrossing(
          previous.x,
          previous.y,
          current.x,
          current.y,
          baselineSeconds,
        );
      }
    }

    return null;
  }

  function findMachineThreshold(series, baselineSeconds) {
    if (!series.data.length) {
      return null;
    }

    if (series.data[0].y > baselineSeconds) {
      return null;
    }

    for (let index = 1; index < series.data.length; index += 1) {
      const previous = series.data[index - 1];
      const current = series.data[index];

      if (current.y > baselineSeconds) {
        return interpolateCrossing(
          previous.x,
          previous.y,
          current.x,
          current.y,
          baselineSeconds,
        );
      }
    }

    return 100;
  }

  function sanitizeConfig(overrides) {
    const merged = Object.assign({}, defaultConfig, overrides);

    merged.children = Math.max(1, Math.round(Number(merged.children) || 1));
    merged.classrooms = Math.max(1, Math.round(Number(merged.classrooms) || 1));
    merged.arrivalWindowMinutes = Math.max(
      1,
      Number(merged.arrivalWindowMinutes) || defaultConfig.arrivalWindowMinutes,
    );
    merged.arrivalPeakBeforeDepartureMinutes = clamp(
      Number(merged.arrivalPeakBeforeDepartureMinutes)
        || defaultConfig.arrivalPeakBeforeDepartureMinutes,
      0,
      merged.arrivalWindowMinutes,
    );
    merged.arrivalSpreadMinutes = Math.max(
      1,
      Number(merged.arrivalSpreadMinutes) || defaultConfig.arrivalSpreadMinutes,
    );
    merged.departureBufferMinutes = clamp(
      Number(merged.departureBufferMinutes)
        || defaultConfig.departureBufferMinutes,
      0,
      Math.max(0, merged.arrivalWindowMinutes - 1),
    );
    merged.rushWindowMinutes = Math.max(
      1,
      Number(merged.rushWindowMinutes) || defaultConfig.rushWindowMinutes,
    );
    merged.runs = Math.max(50, Math.round(Number(merged.runs) || defaultConfig.runs));
    merged.baselineWristbandSeconds = Math.max(
      1,
      Number(merged.baselineWristbandSeconds) || defaultConfig.baselineWristbandSeconds,
    );
    merged.baselineAttendanceSeconds = Math.max(
      0,
      Number(merged.baselineAttendanceSeconds) || defaultConfig.baselineAttendanceSeconds,
    );
    merged.verifySuccessMinSeconds = Math.max(
      0,
      Number(merged.verifySuccessMinSeconds) || defaultConfig.verifySuccessMinSeconds,
    );
    merged.verifySuccessMaxSeconds = Math.max(
      merged.verifySuccessMinSeconds,
      Number(merged.verifySuccessMaxSeconds) || defaultConfig.verifySuccessMaxSeconds,
    );
    merged.redoSeconds = Math.max(
      1,
      Number(merged.redoSeconds) || defaultConfig.redoSeconds,
    );
    merged.parentIncorrectPercent = clamp(
      Number(merged.parentIncorrectPercent) || defaultConfig.parentIncorrectPercent,
      0,
      100,
    );
    merged.machineBaseSeconds = Math.max(
      1,
      Number(merged.machineBaseSeconds) || defaultConfig.machineBaseSeconds,
    );
    merged.machineExtraMinSeconds = Math.max(
      0,
      Number(merged.machineExtraMinSeconds) || defaultConfig.machineExtraMinSeconds,
    );
    merged.machineExtraMaxSeconds = Math.max(
      merged.machineExtraMinSeconds,
      Number(merged.machineExtraMaxSeconds) || defaultConfig.machineExtraMaxSeconds,
    );
    merged.machineIncorrectPercent = clamp(
      Number(merged.machineIncorrectPercent) || defaultConfig.machineIncorrectPercent,
      0,
      100,
    );
    merged.complianceStepPercent = Math.max(
      1,
      Math.round(Number(merged.complianceStepPercent) || defaultConfig.complianceStepPercent),
    );
    merged.struggleStepPercent = Math.max(
      1,
      Math.round(Number(merged.struggleStepPercent) || defaultConfig.struggleStepPercent),
    );
    merged.defaultParentCompliancePercent = clamp(
      Number(merged.defaultParentCompliancePercent)
        || defaultConfig.defaultParentCompliancePercent,
      0,
      100,
    );
    merged.defaultMachineStrugglePercent = clamp(
      Number(merged.defaultMachineStrugglePercent)
        || defaultConfig.defaultMachineStrugglePercent,
      0,
      100,
    );
    merged.parentIncorrectSweep = normalizeSweep(
      merged.parentIncorrectSweep,
      defaultConfig.parentIncorrectSweep,
    );
    merged.machineIncorrectSweep = normalizeSweep(
      merged.machineIncorrectSweep,
      defaultConfig.machineIncorrectSweep,
    );
    merged.parentRushCompliancePenaltyPercent = clamp(
      Number(merged.parentRushCompliancePenaltyPercent)
        || defaultConfig.parentRushCompliancePenaltyPercent,
      0,
      100,
    );
    merged.parentRushIncorrectLiftPercent = clamp(
      Number(merged.parentRushIncorrectLiftPercent)
        || defaultConfig.parentRushIncorrectLiftPercent,
      0,
      100,
    );
    merged.machineRushStruggleLiftPercent = clamp(
      Number(merged.machineRushStruggleLiftPercent)
        || defaultConfig.machineRushStruggleLiftPercent,
      0,
      100,
    );
    merged.machineRushIncorrectLiftPercent = clamp(
      Number(merged.machineRushIncorrectLiftPercent)
        || defaultConfig.machineRushIncorrectLiftPercent,
      0,
      100,
    );
    merged.machineStruggleIncorrectLiftPercent = clamp(
      Number(merged.machineStruggleIncorrectLiftPercent)
        || defaultConfig.machineStruggleIncorrectLiftPercent,
      0,
      100,
    );
    merged.machineTwoIncorrectReductionPercent = clamp(
      Number(merged.machineTwoIncorrectReductionPercent)
        || defaultConfig.machineTwoIncorrectReductionPercent,
      0,
      100,
    );
    merged.machineTwoStruggleFailureReductionPercent = clamp(
      Number(merged.machineTwoStruggleFailureReductionPercent)
        || defaultConfig.machineTwoStruggleFailureReductionPercent,
      0,
      100,
    );

    return merged;
  }

  function runAnalysis(overrides) {
    const config = sanitizeConfig(overrides);
    const complianceRange = buildPercentRange(config.complianceStepPercent);
    const struggleRange = buildPercentRange(config.struggleStepPercent);
    const deadlineSeconds = getReadyDeadlineSeconds(config);

    const baseline = collectScenarioRuns(
      config,
      1000,
      simulateBaseline,
    );
    const baselineEmployeeSeconds = baseline.meanEmployeeSeconds;

    const parentGrid = {};
    const parentHeatmap = [];
    const parentThresholdTable = [];
    let parentSeries = [];
    let parentDefaultSummary = null;

    config.parentIncorrectSweep.forEach(function buildParentIncorrectBand(
      incorrectPercent,
      incorrectIndex,
    ) {
      const points = complianceRange.map(function buildPoint(compliancePercent, pointIndex) {
        const summary = collectScenarioRuns(
          config,
          10000 + incorrectIndex * 2000 + pointIndex * 100,
          function runScenario(activeConfig, rng) {
            return simulateParentScenario(
              activeConfig,
              rng,
              compliancePercent / 100,
              incorrectPercent / 100,
            );
          },
        );

        parentHeatmap.push({
          x: compliancePercent,
          y: incorrectPercent,
          employeeMinutesSaved:
            (baselineEmployeeSeconds - summary.meanEmployeeSeconds) / 60,
          lateProbability: summary.lateProbability * 100,
        });

        return {
          x: compliancePercent,
          summary,
        };
      });

      parentGrid[incorrectPercent] = points;

      const series = toBandSeries(
        `Parent model (${incorrectPercent}% incorrect)`,
        points,
        { incorrectPercent },
      );
      const thresholdPercent = findParentThreshold(series, baselineEmployeeSeconds);
      const defaultPoint = points.find(function find(point) {
        return point.x === config.defaultParentCompliancePercent;
      }) || points[points.length - 1];

      parentThresholdTable.push({
        incorrectPercent,
        thresholdPercent,
        savedMinutesAtDefault:
          (baselineEmployeeSeconds - defaultPoint.summary.meanEmployeeSeconds) / 60,
      });

      if (incorrectPercent === config.parentIncorrectPercent) {
        parentSeries = [series];
        parentDefaultSummary = defaultPoint.summary;
      }
    });

    if (!parentSeries.length) {
      const fallbackIncorrect = config.parentIncorrectSweep[Math.floor(config.parentIncorrectSweep.length / 2)];
      parentSeries = [
        toBandSeries(
          `Parent model (${fallbackIncorrect}% incorrect)`,
          parentGrid[fallbackIncorrect],
          { incorrectPercent: fallbackIncorrect },
        ),
      ];
      parentDefaultSummary = (
        parentGrid[fallbackIncorrect].find(function find(point) {
          return point.x === config.defaultParentCompliancePercent;
        }) || parentGrid[fallbackIncorrect][parentGrid[fallbackIncorrect].length - 1]
      ).summary;
    }

    const parentThresholds = parentSeries.map(function mapThreshold(series) {
      return {
        label: series.label,
        incorrectPercent: series.incorrectPercent,
        thresholdPercent: findParentThreshold(series, baselineEmployeeSeconds),
      };
    });

    const machineEmployeeGridByCount = {
      1: {},
      2: {},
    };
    const machineHeatmap = [];
    const machineThresholdTable = [];
    let machineSeries = [];
    let machineDefaultSummary = null;

    config.machineIncorrectSweep.forEach(function buildMachineIncorrectBand(
      incorrectPercent,
      incorrectIndex,
    ) {
      [1, 2].forEach(function buildMachineCountPoints(machineCount) {
        const points = struggleRange.map(function buildPoint(strugglePercent, pointIndex) {
          const summary = collectScenarioRuns(
            config,
            30000 + machineCount * 10000 + incorrectIndex * 2000 + pointIndex * 100,
            function runScenario(activeConfig, rng) {
              return simulateMachineScenario(
                activeConfig,
                rng,
                machineCount,
                strugglePercent / 100,
                incorrectPercent / 100,
              );
            },
          );

          if (machineCount === 1) {
            machineHeatmap.push({
              x: strugglePercent,
              y: incorrectPercent,
              employeeMinutesSaved:
                (baselineEmployeeSeconds - summary.meanEmployeeSeconds) / 60,
              lateProbability: summary.lateProbability * 100,
            });
          }

          return {
            x: strugglePercent,
            summary,
          };
        });

        machineEmployeeGridByCount[machineCount][incorrectPercent] = points;
      });

      const oneMachineSeries = toBandSeries(
        `Machine model (${incorrectPercent}% incorrect)`,
        machineEmployeeGridByCount[1][incorrectPercent],
        { incorrectPercent, machineCount: 1 },
      );
      const twoMachineSeries = toBandSeries(
        `Machine model (${incorrectPercent}% incorrect)`,
        machineEmployeeGridByCount[2][incorrectPercent],
        { incorrectPercent, machineCount: 2 },
      );
      const defaultPointOne = machineEmployeeGridByCount[1][incorrectPercent].find(function find(point) {
        return point.x === config.defaultMachineStrugglePercent;
      }) || machineEmployeeGridByCount[1][incorrectPercent][Math.floor(machineEmployeeGridByCount[1][incorrectPercent].length / 2)];
      const defaultPointTwo = machineEmployeeGridByCount[2][incorrectPercent].find(function find(point) {
        return point.x === config.defaultMachineStrugglePercent;
      }) || machineEmployeeGridByCount[2][incorrectPercent][Math.floor(machineEmployeeGridByCount[2][incorrectPercent].length / 2)];

      machineThresholdTable.push({
        incorrectPercent,
        oneMachineThresholdPercent: findMachineThreshold(oneMachineSeries, baselineEmployeeSeconds),
        twoMachineThresholdPercent: findMachineThreshold(twoMachineSeries, baselineEmployeeSeconds),
        savedMinutesAtDefaultOne:
          (baselineEmployeeSeconds - defaultPointOne.summary.meanEmployeeSeconds) / 60,
        savedMinutesAtDefaultTwo:
          (baselineEmployeeSeconds - defaultPointTwo.summary.meanEmployeeSeconds) / 60,
      });

      if (incorrectPercent === config.machineIncorrectPercent) {
        machineSeries = [
          Object.assign({}, oneMachineSeries, {
            label: "1 machine",
            machineCount: 1,
          }),
          Object.assign({}, twoMachineSeries, {
            label: "2 machines",
            machineCount: 2,
            strokeDasharray: "16 10",
          }),
        ];
        machineDefaultSummary = defaultPointOne.summary;
      }
    });

    if (!machineSeries.length) {
      const fallbackIncorrect = config.machineIncorrectSweep[Math.floor(config.machineIncorrectSweep.length / 2)];
      const fallbackOne = machineEmployeeGridByCount[1][fallbackIncorrect];
      const fallbackTwo = machineEmployeeGridByCount[2][fallbackIncorrect];
      machineDefaultSummary = (
        fallbackOne.find(function find(point) {
          return point.x === config.defaultMachineStrugglePercent;
        }) || fallbackOne[Math.floor(fallbackOne.length / 2)]
      ).summary;
      config.machineIncorrectPercent = fallbackIncorrect;
      machineSeries = [
        Object.assign(
          {},
          toBandSeries(
            `Machine model (${fallbackIncorrect}% incorrect)`,
            fallbackOne,
            { incorrectPercent: fallbackIncorrect, machineCount: 1 },
          ),
          {
            label: "1 machine",
            machineCount: 1,
          },
        ),
        Object.assign(
          {},
          toBandSeries(
            `Machine model (${fallbackIncorrect}% incorrect)`,
            fallbackTwo,
            { incorrectPercent: fallbackIncorrect, machineCount: 2 },
          ),
          {
            label: "2 machines",
            machineCount: 2,
            strokeDasharray: "16 10",
          },
        ),
      ];
    }

    const machineThresholds = machineSeries.map(function mapMachineThreshold(series) {
      return {
        machineCount: series.machineCount,
        thresholdPercent: findMachineThreshold(series, baselineEmployeeSeconds),
      };
    });

    const machineDeadlineSeries = [1, 2].map(function buildDeadlineSeries(machineCount) {
      return {
        label: `${machineCount} machine${machineCount === 1 ? "" : "s"}`,
        machineCount,
        data: struggleRange.map(function buildPoint(strugglePercent, pointIndex) {
          const summary = collectScenarioRuns(
            config,
            50000 + machineCount * 4000 + pointIndex * 100,
            function runScenario(activeConfig, rng) {
              return simulateMachineScenario(
                activeConfig,
                rng,
                machineCount,
                strugglePercent / 100,
                config.machineIncorrectPercent / 100,
              );
            },
          );

          return {
            x: strugglePercent,
            y: summary.lateProbability * 100,
            lateMeanMinutesIfLate: summary.meanLateSecondsIfLate / 60,
          };
        }),
      };
    });

    const parentLateSeries = [
      {
        label: `Parent (${config.parentIncorrectPercent}% incorrect)`,
        data: (
          parentGrid[config.parentIncorrectPercent] || parentGrid[config.parentIncorrectSweep[0]]
        ).map(function buildPoint(point) {
          return {
            x: point.x,
            y: point.summary.lateProbability * 100,
            lateMeanMinutesIfLate: point.summary.meanLateSecondsIfLate / 60,
          };
        }),
      },
    ];

    const machineDefaultRiskByCount = [1, 2].map(function buildDefaultRisk(machineCount) {
      const summary = collectScenarioRuns(
        config,
        70000 + machineCount * 4000,
        function runScenario(activeConfig, rng) {
          return simulateMachineScenario(
            activeConfig,
            rng,
            machineCount,
            config.defaultMachineStrugglePercent / 100,
            config.machineIncorrectPercent / 100,
          );
        },
      );

      return {
        machineCount,
        summary,
      };
    });

    return {
      config,
      deadlineSeconds,
      baseline,
      parentEmployeeBaselineSeconds: baselineEmployeeSeconds,
      parentSeries,
      machineSeries,
      parentThresholds,
      machineThresholds,
      parentThresholdTable,
      machineThresholdTable,
      parentHeatmap,
      machineHeatmap,
      parentLateSeries,
      machineDeadlineSeries,
      parentDefaultSummary,
      machineDefaultSummary,
      machineDefaultRiskByCount,
    };
  }

  return {
    defaultConfig,
    formatDuration,
    round,
    runAnalysis,
  };
});
