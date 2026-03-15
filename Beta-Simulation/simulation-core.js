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
    runs: 400,
    baselineWristbandSeconds: 20,
    baselineAttendanceSeconds: 3,
    verifySuccessMinSeconds: 3,
    verifySuccessMaxSeconds: 5,
    redoSeconds: 25,
    parentIncorrectMaxPercent: 20,
    machineBaseSeconds: 12,
    machineExtraMinSeconds: 5,
    machineExtraMaxSeconds: 15,
    machineIncorrectPercent: 5,
    complianceStepPercent: 5,
    struggleStepPercent: 5,
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

  function buildChildren(config, rng) {
    const arrivalWindowSeconds = config.arrivalWindowMinutes * 60;
    const meanArrival = arrivalWindowSeconds / 2;
    const stdArrival = arrivalWindowSeconds / 6;
    const children = [];

    for (let index = 0; index < config.children; index += 1) {
      children.push({
        arrival: sampleTruncatedNormal(
          rng,
          meanArrival,
          stdArrival,
          0,
          arrivalWindowSeconds,
        ),
        classroom: index % config.classrooms,
      });
    }

    children.sort(function byArrival(a, b) {
      return a.arrival - b.arrival;
    });

    return children;
  }

  function simulateBaseline(config, rng) {
    const children = buildChildren(config, rng);
    let wristbandAvailableAt = 0;
    const classroomAvailableAt = Array(config.classrooms).fill(0);
    let lastCompletion = 0;
    let totalWait = 0;

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

      lastCompletion = Math.max(lastCompletion, attendanceDone);
      totalWait += attendanceDone - child.arrival;
    }

    return {
      totalCompletionSeconds: lastCompletion,
      averageFamilyProcessSeconds: totalWait / children.length,
    };
  }

  function simulateParentScenario(config, rng, complianceRate, incorrectRate) {
    const children = buildChildren(config, rng);
    const classroomAvailableAt = Array(config.classrooms).fill(0);
    let lastCompletion = 0;
    let totalWait = 0;

    for (const child of children) {
      const applied = rng() < complianceRate;
      const appliedCorrectly = applied && rng() >= incorrectRate;
      const serviceTime = appliedCorrectly
        ? sampleUniform(
            rng,
            config.verifySuccessMinSeconds,
            config.verifySuccessMaxSeconds,
          )
        : config.redoSeconds;

      const classroomIndex = child.classroom;
      const serviceStart = Math.max(
        child.arrival,
        classroomAvailableAt[classroomIndex],
      );
      const serviceDone = serviceStart + serviceTime;
      classroomAvailableAt[classroomIndex] = serviceDone;

      lastCompletion = Math.max(lastCompletion, serviceDone);
      totalWait += serviceDone - child.arrival;
    }

    return {
      totalCompletionSeconds: lastCompletion,
      averageFamilyProcessSeconds: totalWait / children.length,
    };
  }

  function simulateMachineScenario(config, rng, machineCount, struggleRate) {
    const children = buildChildren(config, rng);
    const machineAvailableAt = Array(machineCount).fill(0);
    const classroomAvailableAt = Array(config.classrooms).fill(0);
    let lastCompletion = 0;
    let totalWait = 0;
    const incorrectRate = config.machineIncorrectPercent / 100;

    for (const child of children) {
      let chosenMachine = 0;
      for (let index = 1; index < machineAvailableAt.length; index += 1) {
        if (machineAvailableAt[index] < machineAvailableAt[chosenMachine]) {
          chosenMachine = index;
        }
      }

      const struggleExtra =
        rng() < struggleRate
          ? sampleUniform(
              rng,
              config.machineExtraMinSeconds,
              config.machineExtraMaxSeconds,
            )
          : 0;
      const machineStart = Math.max(child.arrival, machineAvailableAt[chosenMachine]);
      const machineDone = machineStart + config.machineBaseSeconds + struggleExtra;
      machineAvailableAt[chosenMachine] = machineDone;

      const appliedCorrectly = rng() >= incorrectRate;
      const classroomIndex = child.classroom;
      const classroomService = appliedCorrectly
        ? sampleUniform(
            rng,
            config.verifySuccessMinSeconds,
            config.verifySuccessMaxSeconds,
          )
        : config.redoSeconds;
      const classroomStart = Math.max(
        machineDone,
        classroomAvailableAt[classroomIndex],
      );
      const classroomDone = classroomStart + classroomService;
      classroomAvailableAt[classroomIndex] = classroomDone;

      lastCompletion = Math.max(lastCompletion, classroomDone);
      totalWait += classroomDone - child.arrival;
    }

    return {
      totalCompletionSeconds: lastCompletion,
      averageFamilyProcessSeconds: totalWait / children.length,
    };
  }

  function estimateScenario(config, runs, seedOffset, scenarioRunner) {
    let totalCompletion = 0;
    let totalFamilyProcess = 0;

    for (let runIndex = 0; runIndex < runs; runIndex += 1) {
      const rng = createRng(seedOffset + runIndex * 97);
      const result = scenarioRunner(config, rng);
      totalCompletion += result.totalCompletionSeconds;
      totalFamilyProcess += result.averageFamilyProcessSeconds;
    }

    return {
      meanCompletionSeconds: totalCompletion / runs,
      meanFamilyProcessSeconds: totalFamilyProcess / runs,
    };
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

  function buildParentSeries(config) {
    const complianceRange = buildPercentRange(config.complianceStepPercent);
    const seriesCount = 5;
    const incorrectSeries = [];

    for (let index = 0; index < seriesCount; index += 1) {
      incorrectSeries.push(
        seriesCount === 1
          ? 0
          : (config.parentIncorrectMaxPercent / (seriesCount - 1)) * index,
      );
    }

    return incorrectSeries.map(function buildSeries(incorrectPercent, seriesIndex) {
      const data = complianceRange.map(function point(compliancePercent, pointIndex) {
        const estimated = estimateScenario(
          config,
          config.runs,
          10000 + seriesIndex * 1000 + pointIndex * 100,
          function runScenario(activeConfig, rng) {
            return simulateParentScenario(
              activeConfig,
              rng,
              compliancePercent / 100,
              incorrectPercent / 100,
            );
          },
        );

        return {
          x: compliancePercent,
          y: estimated.meanCompletionSeconds,
        };
      });

      return {
        label: `${round(incorrectPercent, 0)}% incorrect`,
        incorrectPercent,
        data,
      };
    });
  }

  function buildMachineSeries(config) {
    const struggleRange = buildPercentRange(config.struggleStepPercent);
    const machineCounts = [1, 2];

    return machineCounts.map(function buildSeries(machineCount, seriesIndex) {
      const data = struggleRange.map(function point(strugglePercent, pointIndex) {
        const estimated = estimateScenario(
          config,
          config.runs,
          30000 + seriesIndex * 1000 + pointIndex * 100,
          function runScenario(activeConfig, rng) {
            return simulateMachineScenario(
              activeConfig,
              rng,
              machineCount,
              strugglePercent / 100,
            );
          },
        );

        return {
          x: strugglePercent,
          y: estimated.meanCompletionSeconds,
        };
      });

      return {
        label: `${machineCount} machine${machineCount === 1 ? "" : "s"}`,
        machineCount,
        data,
      };
    });
  }

  function interpolateCrossing(x1, y1, x2, y2, target) {
    if (y1 === y2) {
      return x1;
    }

    const slope = (y2 - y1) / (x2 - x1);
    return x1 + (target - y1) / slope;
  }

  function findParentThreshold(series, baselineSeconds) {
    if (series.data.length === 0) {
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
    if (series.data.length === 0) {
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
    merged.redoSeconds = Math.max(1, Number(merged.redoSeconds) || defaultConfig.redoSeconds);
    merged.parentIncorrectMaxPercent = clamp(
      Number(merged.parentIncorrectMaxPercent) || defaultConfig.parentIncorrectMaxPercent,
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

    return merged;
  }

  function runAnalysis(overrides) {
    const config = sanitizeConfig(overrides);
    const baseline = estimateScenario(config, config.runs, 1000, simulateBaseline);
    const parentSeries = buildParentSeries(config);
    const machineSeries = buildMachineSeries(config);

    const parentThresholds = parentSeries.map(function mapThreshold(series) {
      return {
        incorrectPercent: series.incorrectPercent,
        thresholdPercent: findParentThreshold(series, baseline.meanCompletionSeconds),
      };
    });

    const machineThresholds = machineSeries.map(function mapThreshold(series) {
      return {
        machineCount: series.machineCount,
        thresholdPercent: findMachineThreshold(series, baseline.meanCompletionSeconds),
      };
    });

    return {
      config,
      baseline,
      parentSeries,
      machineSeries,
      parentThresholds,
      machineThresholds,
    };
  }

  return {
    defaultConfig,
    formatDuration,
    round,
    runAnalysis,
  };
});
