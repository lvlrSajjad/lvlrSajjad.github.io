---
layout: writing
permalink: /writing/four-corrections-to-one-number/
title: "Four corrections to one number"
description: "A load-bearing latency figure was corrected four times in one day. Every correction made it worse, each was caught by a different mechanism, and not one of them needed new data — the arithmetic to catch all four was already in the repository."
date: 2026-09-17
---

*I have spent a year on a tool whose entire purpose is latency. This week I
finally measured it. The headline number was corrected four times in one day,
every correction moved it in the same direction, and none of them required data
I did not already have.*

The tool gives a coding agent eyes and hands for the iOS Simulator: read the
screen, tap a thing, verify it worked, remember the route. I started it because
the existing way of doing this was too slow to watch. So the number that matters
is wall clock per step, and the claim I had been making, in a README, in an
article, and to anyone who asked, was that it had reached human speed.

It has not. Here is how the number moved.

## The claim, and the arithmetic behind it

A model deciding what to do next costs about 20 seconds of round trip. The
tool's own work — read the screen, resolve the intent, tap, verify — measured
about 1.7 s. If one model call covers `n` steps, then

```
per step = (model round trip + 1.7s × n) / n
```

which is 21.7 s at `n = 1`, 11.7 s at `n = 2`, 6.7 s at `n = 4`. The recorded
median across 186 runs was `n = 2.0`.

That arithmetic is the most useful thing I worked out this year, and it holds. It
says something counter-intuitive and correct: **making the engine faster is
nearly worthless.** 1.7 s beside 20 s is noise. Every hour spent on perception
speed buys single-digit percentages, and the only variable worth touching is `n`
— how many steps one decision covers.

Then a replayed route, which needs no model at all, measured **1.98 s per step**
against a human tester's measured **1.95 s**. Parity. I wrote it up.

## Correction one: the stranger was not a stranger

A field report came back reproducing the result on a different app: 1.82 s per
step by external stopwatch, 7 steps, 12.773 s, measured outside the tool so it
did not depend on my own clock. I wrote that an independent third party had
reproduced it on another machine.

The report's own second paragraph said *"I am not a naive peer."* I quoted that
caveat and then, two paragraphs later, called the result independent replication
anyway. It ran on my laptop, on my benchmark simulator, from my working tree,
with the project's notes in its context. Its line "on a machine that is not
yours" was simply wrong, and I repeated it without checking it against the
device identifier printed four lines above it in the same file.

Same-host is not a technicality here. The project's own notes record identical
code spanning `HPI_time` **0.406–0.558** across device conditions on one
machine — a 37% spread. A second reading on the same device cannot speak to
that. The honest status of the number was: *measured three times, on one laptop,
never by a stranger.*

## Correction two: the engine is not the product

Someone pointed out that I was quoting the engine's number as the tool's.

That is true and it is worse than a wording problem. Driving an app for real
means a model deciding each move. At the recorded `n = 2.0`, that is **11.7 s
per step — about six times a human**, and when a failure drops the caller back
to one call per step, **21.7 s, about eleven times**. The parity result belongs
to *replay*: a recorded route, no model in the loop, and it only exists after
someone has already walked the route once.

My tables led with the flattering rows. The unflattering ones were in the same
table, three lines down.

## Correction three: the human number includes the thinking

This one dismantled more than the first two.

A human tester's 1.95 s per step is the *whole* loop: look at the screen, decide
what to do, do it. The tool's 1.7 s is the mechanical half with the deciding
removed — because the deciding *is* the 20-second round trip. I had been
comparing a subset to a whole and calling the subset faster.

It also took out the row I thought was safe. A replayed route decides *nothing*.
It is a recording being played back. Its honest counterpart is a person
repeating a route they have memorised, who would be comfortably under 1.95 s.
Replay against a human working a wizard out for the first time is a rehearsal
measured against a first attempt.

Every table in the project now carries a column saying whether the row includes
a decision:

| | decides | per step |
| --- | --- | --- |
| a human tester | yes | **1.95 s** |
| the tool, batch of 2 (recorded median) | yes | **~11.7 s** |
| the tool, one call per step | yes | ~21.7 s |
| — the tool's mechanical half | **no** | ~1.7 s |
| — a replayed route | **no** | 1.98 s |

One like-for-like comparison in six rows. I had been quoting from the bottom
half.

## Correction four: a fixed cost wearing a per-step costume

The first three came from people. The fourth came from finally running the
benchmark suite end to end, which had never completed since the instrumentation
landed.

Two routes, no model in the loop:

| route | steps | agent | per step | human | per step |
| --- | --- | --- | --- | --- | --- |
| contacts (2 steps) | 2 | 12419 ms | **6.2 s** | 4300 ms | 2.15 s |
| settings (4 steps) | 4 | 15281 ms | 3.8 s | 7799 ms | 1.95 s |

With **zero model calls**, the tool is 2.9× the human on the short route and
2.0× on the longer one. That does not fit `1.7s × n` at all, and the reason is
that a cold app launch is a **one-off cost amortised over the route**, not a
per-step one:

```
per step = (model round trip + launch cost + ~1.7s × n) / n
```

Which reconciles everything. A 7-step replay at 1.82 s/step and a 2-step route
at 6.2 s/step are the same machine: the launch is spread over 7 steps in one
case and 2 in the other. The `~1.7 s` figure describes **warm taps inside a
batch**, and I had been quoting it as though it covered whole routes. Short
routes are materially worse than every table I had published.

## What all four have in common

**Every correction moved the number the same way.** Four independent errors, one
direction. That is not luck; it is a preference expressing itself four times. In
each case the flattering reading was available and I took it — the peer was a
stranger, the engine was the product, the subset beat the whole, the fixed cost
was per-step.

**None of them needed new data.** The UDID that disproved correction one was in
the file I was quoting. The unflattering rows in correction two were in my own
table. Correction three needed nothing but reading what 1.95 s contains.
Correction four needed a suite that already existed to be run once.

**And the useful conclusion survived all four.** `1.7 s` beside `20 s` is still
noise; making the engine faster is still nearly worthless; `n` is still the only
variable that matters. The conclusion was never load-bearing on the part I got
wrong. Which is its own lesson: I defended the number and the number was
decoration. The reasoning underneath it was fine and could have been stated
without a parity claim at all.

## A fifth thing, in a different metric

While measuring the above I found the same shape somewhere else, and it is worth
a paragraph because it is the version that would have bitten a user.

The suite gates on accuracy: of the runs, how many completed cleanly.

```
HPI_accuracy = clean runs / total runs
```

Of 17 runs, 7 passed and **5 failed because the simulator failed** — the guest's
window server crashed twice, and `simctl` stopped answering for 90 seconds three
times. All five counted against accuracy. The gate was partly measuring the
platform's stability and reporting it as my code's correctness.

The fix is one word in the denominator:

```
HPI_accuracy = clean runs / measurable runs
             where measurable excludes runs whose own log records a device fault
```

The project had already made this exact mistake in the *other* column, months
earlier: the time metric took every run's wall clock regardless of whether the
run finished, and since a failure is fast, breaking a route registered as the
agent getting quicker. That was found, written up, fixed — in one column. The
mirror-image fault sat in the column next to it.

## The transferable part

**A number's scope decays every time you quote it.** "The engine's warm
per-step cost, excluding decisions and launches" becomes "the tool is at human
speed" in about three repetitions, and nobody is lying at any step. Write the
scope into the number's name, or into a column beside it, because prose will not
hold it.

**Check a claim's self-description against its own data.** The peer report told
me what machine it ran on and also printed the identifier proving otherwise, four
lines apart. A report is evidence about the system; it is not evidence about
itself.

**Never borrow a threshold from a different quantity.** I justified a new
detector with a measured "sensors agree on 0.33–0.47" from the project's own
docs, then watched it print a live reading of 0.846 next to that band. The
0.33–0.47 was about structural tokens; my ratio was element-level. Five minutes
of sampling gave the real range — 0.67–0.93 — and a threshold at 0.1 that sits
6.7× below the observed floor instead of inside the metric's noise.

**When a metric is wrong in one column, check the column next to it.** The same
misunderstanding — counting runs that could not be measured — was found and
fixed in the time metric and left standing in the accuracy metric. Fixes go
where the bug was noticed, not where its cause reaches.

**And if every correction to a number goes the same direction, stop correcting
the number.** Go and look at why you keep reaching for that particular reading.
