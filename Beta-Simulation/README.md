# Beta-Simulation

Standalone simulation for the daycare wristband prototype.

## What it models

- `Current process`: one employee applies wristbands at an average of 20 seconds per child, then the child goes to classroom attendance.
- `Parent-applied prototype`: parents can apply wristbands before classroom check-in. The main graph shows employee time versus parent compliance, using 5 seconds per child for check/attendance and 25 extra seconds for each failed parent case.
- `Machine prototype`: one or two dispensing machines are tested. The main graph sweeps the share of parents whose machine attempt still ends in the employee redo path.

Both the parent model and the machine model are judged by employee time saved.

## Key assumptions used from the brief

- `90` children
- `10` classrooms acting as parallel attendance/check lines
- `30` minute arrival window with a normal-arrival peak about `9` minutes before departure
- `3.5` minute arrival spread around that peak
- `20` second average for the current wristband step
- `3` seconds for current attendance
- `3` to `5` seconds for a successful classroom wristband check
- `25` seconds when a wristband is missing or must be redone
- `12` seconds total machine time before any struggle delay
- Arrivals follow a non-uniform normal distribution rather than a constant flow

Parent time at the outside wristband station is intentionally excluded from the main metric because it is no longer daycare employee time. Machine queue time is also excluded from the employee-time metric; the machine graph only counts employee check time and employee redo time.

## Files

- `index.html`: browser UI
- `styles.css`: layout and chart styling
- `simulation-core.js`: simulation engine shared by the browser and CLI summary
- `run-simulation.cjs`: terminal summary for the default case
- `generate-report.cjs`: static report and chart generator
- `outputs/`: generated presentation assets

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

The generated files in `outputs/` can be committed to the repository when you want the visuals to appear directly in the repo.
