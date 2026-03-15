# Beta-Simulation

Standalone simulation for the daycare wristband prototype.

## What it models

- `Current process`: one employee applies wristbands at an average of 20 seconds per child, then the child goes to classroom attendance.
- `Parent-applied prototype`: parents can apply wristbands before classroom check-in. The main graph sweeps parent compliance and compares multiple incorrect-application rates.
- `Machine prototype`: one or two dispensing machines are tested. The main graph sweeps the share of parents who struggle at the machine and need an extra 5 to 15 seconds.

The decision metric is the total time until all children are ready.

## Key assumptions used from the brief

- `90` children
- `10` classrooms acting as parallel attendance/check lines
- `20` second average for the current wristband step
- `3` seconds for current attendance
- `3` to `5` seconds for a successful classroom wristband check
- `25` seconds when a wristband is missing or must be redone
- `12` seconds total machine time before any struggle delay
- Arrivals follow a normal distribution over an editable arrival window

Parent time at the outside wristband station is intentionally excluded from the main metric because the brief specified that it is no longer daycare employee time. Machine time is included because it creates a queue at drop-off.

## Files

- `index.html`: browser UI
- `styles.css`: layout and chart styling
- `simulation-core.js`: simulation engine shared by the browser and CLI summary
- `run-simulation.cjs`: terminal summary for the default case
- `generate-report.cjs`: static report and chart generator
- `outputs/`: generated presentation assets

`outputs/` is generated on demand and ignored by git so the repo stays clean.

## How to use it

Open [index.html](/Users/mohamedelsayed/Desktop/ESC102/remote_clone/Beta-Simulation/index.html) in a browser and click `Run Simulation` after changing assumptions.

For a quick terminal summary:

```bash
node /Users/mohamedelsayed/Desktop/ESC102/remote_clone/Beta-Simulation/run-simulation.cjs
```

To regenerate the static visuals and HTML report:

```bash
node /Users/mohamedelsayed/Desktop/ESC102/remote_clone/Beta-Simulation/generate-report.cjs
```
