---
layout: writing
permalink: /writing/your-gate-is-fine-its-reference-is-wrong/
title: "Your gate is fine. Its reference is wrong."
description: "A broken automated check announces itself. A check whose baseline is corrupted keeps passing, keeps proving it ran, and quietly asks for less — and every summary statistic you have will say the run went well."
date: 2026-09-18
---

*Two of these cost me a night. The interesting part is that the check never
failed, never errored, and never reported anything untrue.*

Anyone who builds an automated quality gate learns to distrust it. Mine decides
whether a machine-written code change is allowed in front of me:

```
survives  ⇔  the diff touched only the files the task named
          ∧  the type-checker is clean, with nothing introduced elsewhere
          ∧  every test that passed before still passes
```

So I did the paranoid things. Seven named ways to cheat it, each with a
committed control proving the gate rejects it. A precondition, frozen in advance,
saying the gate must be able to *prove what it checked* before any number from it
is believed: the controls must fail in the real pipeline, every survivor's verdict
must show the suite actually ran, and at least one survivor must re-verify from
scratch against a reimplementation that shares no code with the verifier.

All three held all night. Four consecutive runs were still garbage.

## The shape of the failure

That third clause — *every test that passed before still passes* — has a word in
it doing enormous unexamined work. **Before.** It refers to a baseline: a
recording of the project's state, captured earlier, that the post-change state is
compared against.

A gate that breaks is cheap. It throws, or it refuses everything, and you find
out in minutes.

A gate whose **reference** is corrupted does not break. It runs, compares
correctly, reports honest fields, and returns a verdict that is internally
consistent with everything it can see. It has simply started asking for less. If
3,900 tests were silently absent when the baseline was taken, then those 3,900
tests never have to pass again — and nothing in the verdict is in a position to
mention it.

Every summary statistic I had said the run went well.

## Two of them, in one night

**One.** I ran the harness through `npx`. npm exports its own state into the
environment — `npm_config_cache`, `npm_config_prefix`, `INIT_CWD`, a dozen
`npm_package_*` — and every child process inherits it, including the project's
test runner. One of that project's test dependencies derives a cache path from
those variables, so it went looking for its cached binary where npm pointed
instead of where the project had put it, failed a checksum on what it found, and
took every test suite that needed it down with it. About 170 suites. They vanish
from the baseline as *absences*, not failures.

**Two.** The test runner's cache directory is global by default. My harness makes
a fresh sandbox per task, so a twelve-task run creates twenty-four
differently-rooted copies of a project, all writing to one cache. It reached
3.8 GB. Whole test files stopped loading, and only inside long runs — the
symptom's onset is a property of how much you've run, not of what you changed.

Clearing that cache, with no code change at all, turned *zero of twelve
candidates surviving* into *eleven of twelve*. Same tasks, same inputs, same gate.

Neither is exotic. Both are the same sentence: **a stage inherited state from
something that was not the thing under test.** Once from the environment, once
from the filesystem.

## Why I chased five wrong answers first

I want to be precise about how bad my reasoning was, because the debugging
failure is more instructive than the bugs.

The symptom was ~170 test suites failing to load inside a long run. I proposed,
in order: external load on the machine; memory pressure from the runner's own
worker processes; a resident local model competing for RAM; the sandbox being
subtly incomplete; the candidate change genuinely breaking something. Five
hypotheses. Every one was refuted by measurement. Several I had stated with
real confidence first.

The error underneath all five was the same and it is embarrassingly simple: **I
kept testing my hypothesis in a setup that differed from the real one in ways I
had not enumerated.** The clearest case — I suspected the resident model was
exhausting memory, so I ran the suite standalone to check. It was fine. What I
had done, without registering it, was kill the model first. I removed the
variable I was testing and read the result as exonerating.

What eventually worked was not cleverness. It was holding everything fixed and
changing exactly one thing, accepting that each test cost four minutes, and
preferring a slow measurement to a fast argument. The decisive artefact wasn't a
theory either — it was noticing that a run with **zero changes applied** had lost
90 tests against its own baseline. Nothing a candidate did can explain a
regression in a run containing no changes. That one observation eliminated more
than all five hypotheses combined.

## The check that actually saved me

I had, for the wrong reasons, added a rule: a run's baseline must match a
reference measured separately on a quiet machine, and a run whose baseline
doesn't match is **discarded, never repaired**.

I wrote that believing the cause was memory pressure. That belief was wrong. The
rule caught all four corrupted runs anyway.

It worked because it doesn't reason about causes at all. It compares a
measurement against a known-good value and refuses on mismatch. A guard built
from a correct-sounding causal story would have been narrower and would have
missed both real mechanisms. **Validate against references, not against
explanations** — your explanation is exactly the thing most likely to be wrong
when something surprising is happening.

The corollary is uncomfortable: a reference is only valid for the commit it was
measured at. Both repositories I was testing against moved under me overnight,
which is what real repositories do.

## What to take from this

If you maintain an automated gate — an eval harness, a CI quality check, a
regression suite that decides what a human reviews — three things:

**Ask what your gate compares against, and how you would know if it were
wrong.** Most gate paranoia is aimed at the *check*: is the assertion right, can
it be cheated, does it fail closed? Almost none is aimed at the *reference*. A
corrupted reference is strictly worse, because a broken check is visible and a
weakened one is not.

**Isolate a stage in every dimension it can carry state.** Environment,
filesystem, cache. I had thought about sandboxing the *code*, which is the
obvious one, and not about the other three. Two of them cost me a night, on the
same symptom, hours apart.

**Separate "did it fail" from "is it absent".** My gate treated a test that
disappeared from a report identically to a test that failed. That's wrong in both
directions: a test whose name is generated from a timestamp gets a new identity
every run and looks like a fresh regression forever, while a suite that failed to
load vanishes entirely and looks like nothing at all.

None of this is about machine learning, models, or generated code. It is about
the oldest problem in measurement: **the instrument was fine and the calibration
was off**, and the instrument has no way to tell you that.

---

*This came out of building a system where small local models make code changes
and a mechanical gate decides what I'm allowed to see. The frozen decision rule
that experiment ran against, and the perfect score it vetoed, is
[a separate note](/writing/a-perfect-score-and-a-veto/).*
