# Beta-Simulation

Standalone simulation for the daycare wristband prototype.

## What it models

- `Current process`: one employee applies wristbands at an average of 20 seconds per child, then the child goes to classroom attendance.
- `Parent-applied prototype`: parents can apply wristbands before classroom check-in. The model separates `non-compliance` from `incorrect application among compliers`.
- `Machine prototype`: one or two dispensing machines are tested. The model separates `struggle-led redo` from `incorrect-after-machine redo`.

Both prototypes are judged by `employee time saved` relative to the current process.

The simulation also tracks:
- `ready-by deadline risk`
- `mean lateness when a run misses the deadline`
- `missed departure probability`
- `active staff time`
- `task switching`
- `supervision interruptions`
- `10th to 90th percentile confidence bands`
- `sensitivity heatmaps`
- `break-even tables`

## Key assumptions used from the brief

- `90` children
- `10` classrooms acting as parallel attendance/check lines
- `30` minute arrival window with a normal-arrival peak about `9` minutes before departure
- `3.5` minute arrival spread around that peak
- `5` minute ready-by deadline before departure
- `20` second average for the current wristband step
- `3` seconds for current attendance
- `3` to `5` seconds for a successful classroom wristband check
- `25` extra seconds when a wristband is missing or must be redone
- `12` seconds total machine time before any struggle delay
- Late arrivals are modeled as more failure-prone than early arrivals

Parent time outside the classroom is intentionally excluded from the employee-time metric. Machine queue time is also excluded from the employee-time metric, but it is still included in the deadline-risk calculations.

## Metric definitions

- `active staff time`: employee-handled seconds only. It excludes parent effort and machine waiting time.
- `missed departure probability`: the share of runs whose final classroom completion happens after the actual departure time. This uses full end-to-end completion time, so machine queueing still counts even when staff time is low.
- `task switching`: an estimate, not a literal click-by-click count. Every time a staffed line goes idle and later restarts, that counts as one interruption, and the reported metric treats that as `2` switches: away from the task and back to it. In the current process this includes the wristband desk and classroom lines; in the parent and machine scenarios it includes classroom lines only.

## Outputs

Generated files in `outputs/`:

- `decision-dashboard.svg`
- `parent-compliance.svg`
- `machine-threshold.svg`
- `sensitivity-atlas.svg`
- `report.html`
- CSV exports for the line charts, heatmaps, and deadline-risk table

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

## Important note about the default deadline metric

With the current default arrival model, some children still arrive after the `ready-by` target. That means the deadline miss rate saturates at `100%` across the default scenarios. The outputs still show meaningful differences in:

- employee minutes
- average minutes past the ready-by target
- sensitivity to compliance, incorrect application, and machine struggle

If you want deadline-risk comparisons that discriminate more clearly, move arrivals earlier or redefine the target to the actual departure time instead of `5` minutes before it.
