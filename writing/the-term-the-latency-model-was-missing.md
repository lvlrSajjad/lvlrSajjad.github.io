---
layout: writing
permalink: /writing/the-term-the-latency-model-was-missing/
title: "The term the latency model was missing"
description: "A two-term model of per-step wall clock predicted the tool was at human speed. Running the benchmark suite end to end falsified it, and the third term reconciles two measurements that had looked contradictory."
date: 2026-09-17
---

*A model of where the time goes, the prediction it made, and the measurement
that broke it. The replacement has three terms instead of two, and it reconciles
two numbers that had looked inconsistent for a week.*

The tool under discussion gives a coding agent eyes and hands for the iOS
Simulator: read the screen, tap a thing, verify it worked, remember the route.
The quantity that matters is wall clock per step.

## The model

Two terms. A model deciding what to do next costs about 20 s of round trip. The
tool's own work — read the screen, resolve the intent, tap, verify — measures
about 1.7 s. If one model call covers `n` steps:

```
per step = (model round trip + 1.7s × n) / n
```

21.7 s at `n = 1`, 11.7 s at `n = 2`, 6.7 s at `n = 4`. The recorded median
across 186 runs is `n = 2.0`.

## What it got right, and it is the load-bearing part

**The round trip dominates and the engine is noise.** A field report measured
the split directly: of 462 s of wall clock, ~156 s (34%) was the tool and ~276 s
(60%) was the agent thinking between calls. A later session on a different app
measured 32% / 68%. Two independent readings, same conclusion.

The consequence is counter-intuitive and it reordered the whole project:
**making perception faster is nearly worthless.** 1.7 s beside 20 s is noise —
halve it and the total moves by single digits. `n` is the only variable with
leverage, which recasts every hard failure that drops a caller back to one call
per step as a *latency* bug rather than a correctness one.

That prediction has held under everything below. The same route went from 33
tool calls to 16 in two days, with no code made faster anywhere.

## What it got wrong: the launch is a fixed cost

The suite had never completed end to end since the instrumentation landed.
Running it did, and the model failed. Two routes, **no model in the loop at
all**:

| route | steps | agent | per step | human | per step |
| --- | --- | --- | --- | --- | --- |
| contacts | 2 | 12419 ms | **6.2 s** | 4300 ms | 2.15 s |
| settings | 4 | 15281 ms | 3.8 s | 7799 ms | 1.95 s |

2.9× a human on the short route, with nothing thinking. `1.7s × n` predicts
1.7 s. It is not a small miss.

The missing term is a cold app launch, which is a **one-off cost amortised over
the route**, not a per-step one:

```
per step = (model round trip + launch cost + ~1.7s × n) / n
```

This reconciles two measurements that had looked contradictory. A 7-step replay
came in at 1.82 s/step; a 2-step route at 6.2 s/step. Same machine, same engine
— one launch spread over 7 steps in one case and over 2 in the other. The
`~1.7 s` figure describes **warm taps inside a batch**, and as a whole-route
cost it makes short routes look far better than they are.

Two things follow. Short routes are the expensive ones per step, which is the
opposite of the intuition that short is cheap. And the amortisation argues for
longer routes for the same reason `n` does — both spread a fixed cost.

## What it got wrong again: the comparison basis

The two-term model predicted parity. A replayed route, needing no model,
measured **1.98 s per step** against a human tester's **1.95 s**.

Those two numbers are not comparable, and the reason is what each one contains.
A human's 1.95 s is the whole loop — look, decide, act. The tool's 1.7 s is the
mechanical half with the deciding removed, because the deciding *is* the
20-second round trip. And a replayed route decides nothing at all: it is a
recording being played back, so its honest counterpart is a person repeating a
route they have memorised, who would be well under 1.95 s.

So the tables now carry a column for whether a row includes a decision:

| | decides | per step |
| --- | --- | --- |
| a human tester | yes | **1.95 s** |
| the tool, batch of 2 (recorded median) | yes | **~11.7 s** |
| the tool, one call per step | yes | ~21.7 s |
| — the tool's mechanical half | **no** | ~1.7 s |
| — a replayed route | **no** | 1.98 s |

One like-for-like comparison in six rows: **1.95 s against ~11.7 s, about six
times a human**, rising to about eleven when a failure forces a call per step.

## A thesis about the metric, also falsified

The accuracy gate asked:

```
HPI_accuracy = clean runs / total runs
```

The implicit thesis is that a failed run is evidence about the code. Of 17 runs
in that suite, 7 passed and **5 failed because the simulator failed** — the
guest's window server crashed twice, `simctl` stopped answering for 90 s three
times. All five counted against accuracy, so the gate was partly measuring the
platform's stability and reporting it as code correctness.

```
HPI_accuracy = clean runs / measurable runs
             where measurable excludes runs whose own log records a device fault
```

A run the platform broke is **unmeasured**, not inaccurate. The same project had
already reached this conclusion in the *other* column: the time metric used to
take every run's wall clock regardless of completion, and since a failure is
fast, breaking a route registered as the agent getting quicker. Same thesis,
same refutation, one column over.

## A thesis about the platform, replaced

The suite had a standing explanation: the benchmark wedges the device it
measures, persistently, and only a restart cures it.

The measurement says otherwise. The 69-second failure was
`The system shell (SpringBoard:58637) probably crashed`. A device read taken
seconds later reported **healthy**, with sensor fusion at 0.857. The window
server dies, the launch fails, and it comes back on its own — a *transient*
crash, not a persistent wedge. Which explains why a dozen occurrences produced
no observation: by the time anything looks, there is nothing to see.

That changes the remedy. A ~40 s device restart is a heavy cure for something
that self-heals in seconds; waiting for the shell and retrying the launch is the
cheap one, and it had never been tried because the wrong thesis made it look
pointless.

## Two measurements worth keeping

**Sensor fusion on a healthy screen.** The tool reads the accessibility tree
live and in-process, and reads OCR off a framebuffer that can go stale without
saying so. If both report plenty of elements and almost none of them fuse, they
are describing different screens, and the frame is the stale one. Sampled across
five real screens:

```
fusion = elements seen by both / min(seen by tree, seen by OCR)

0.857   0.833   0.929   0.846   0.667      median 0.846
```

Healthy is **0.67–0.93**, the floor belonging to the sparsest screen. A
stale-frame threshold at **0.1** therefore sits 6.7× below the observed floor,
rather than inside the metric's own noise — which is the failure mode of the
time gate this project retired, whose band sat inside a 37% spread and so could
only ever be silent or wrong.

**Step ratio.** `step_ratio` was **1** throughout the suite: when a run
completed, it took exactly the minimum number of steps. Whatever else is slow,
it does not wander.

## The transferable part

**Write the model down as terms, not as a number.** `(round trip + 1.7s × n)/n`
survives being wrong in a way "we're at human speed" cannot. When the
measurement came in at 6.2 s/step, the two-term form made it obvious that a
*term* was missing rather than that a number was off — and a missing term is
findable in an afternoon.

**A prediction that fails at 3.6× is a better result than one that passes.** The
launch term is the most useful thing in this note, and it exists because a
prediction of 1.7 s met a measurement of 6.2 s. None of the confirming evidence
taught anything comparable.

**State what a quantity contains, in the same place as the quantity.** Most of
the trouble here was two numbers measuring different things — a loop that
decides against one that does not, a per-step cost against an amortised one. A
column reading `decides: yes/no` does more work than a paragraph of prose.

**When a metric is wrong in one column, check the column beside it.** Counting
runs that could not be measured was diagnosed and fixed in the time metric, and
left standing in the accuracy metric next to it.

**And keep the thesis separable from the claim it decorates.** Everything that
broke here was the headline. Nothing that broke touched the finding that
reordered the project — the round trip dominates, `n` is the lever — because
that finding never depended on the parity number at all.
