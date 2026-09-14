---
layout: writing
permalink: /writing/the-gate-is-only-as-honest-as-what-reaches-it/
title: "The gate is only as honest as what reaches it"
description: "Six times a measurement said a model was bad at its job, and six times the model was fine. A field guide to the failure that looks exactly like the result you were expecting."
date: 2026-09-15
---

*Every one of these was found by reading a discarded output instead of a
summary statistic. That is the whole method.*

I've been building a system that judges machine-generated code mechanically: a
candidate compiles, runs, and has to kill a deliberately introduced bug before
anyone is allowed to look at it. The appeal is that it converts taste into
arithmetic. You get a survival rate, and survival rates can be compared.

Six times now, a survival rate has been about my plumbing rather than about the
model. Every time it looked exactly like the result I was expecting. Here they
are, because the pattern is more useful than any of them individually.

## 1. Six out of six, and the model was fine

First real end-to-end run. Six candidates, six compile failures. The verdicts
read precisely like a 7B that cannot write TypeScript — which is, after all,
the null hypothesis.

The serving layer streamed the model's end-of-turn token `<|im_end|>` as
*content*, inside the message body, rather than as a finish reason. So every
candidate arrived with a stray token after its closing code fence. The fence
stripper anchored at end-of-string, missed, and handed the verifier a file with
garbage on the last line.

Stripping the marker before unwrapping the fence took the same six candidates
from **0/6 to 6/6** with nothing else changed.

If I had reported that day's number, it would have been a real measurement of
nothing.

## 2. The mutation tool could not see the failures

A candidate survives by killing a mutant — the verifier corrupts the function
and the test has to notice. The Swift mutation tool decides a mutant died by
matching the test runner's output against a regular expression:

```
with ([1-9]{1}[0-9]{0,}) failure
```

That is XCTest's summary line. The project also uses Swift Testing, the newer
framework, which never prints that sentence.

So every detected mutant of a `@Test` function came back as `runtimeError` —
which is also what a crash looks like, and which doesn't count as a kill. **No
Swift Testing candidate could ever have survived anything.** Not "rarely". Not
"with lower probability". Never, by construction.

I found it by reading the regex out of the installed binary, after noticing
that one framework's numbers were suspiciously worse than the other's. The fix
appends the sentence the tool reads, and only when the newer framework has
actually reported a failed run. The kill count that had been zero became two.

Two is a small number. Zero-by-construction is not a small problem.

## 3. The determinism check that passed on nothing

Evaluating Apple's on-device Foundation Models as a worker, through the
recommended community shim. First run: 0 of 20, every candidate empty.

The shim's streaming endpoint answers a streamed request with a single
`{"delta":{},"finish_reason":"stop"}` frame and `[DONE]`. No content, ever. The
non-streaming path returns a complete file.

The part worth pausing on: the harness also runs a determinism check — same
prompt five times, outputs must be byte-identical. **It passed 3/3.** Three
identical empty strings are byte-identical. A check designed to catch
non-reproducibility confirmed perfect reproducibility of nothing at all.

It gets better. The shim's non-streaming path reports
`{"prompt_tokens": 0, "completion_tokens": 0}` for a 600-character answer. The
code already refused a response that sent *no* usage block — an honest failure
— and this one answers the question dishonestly instead, so it sailed through
and would have landed a zero in the token accounting looking exactly like a
measurement.

The fix is arithmetic, not judgement: output that is not empty cannot have cost
zero completion tokens.

## 4. The test suite that exits 0 having run nothing

`swift test` returns exit status 0 when it executes zero tests. A filter that
matches nothing, or an `XCTestCase` whose methods aren't named `test…`, and you
get a clean, cheerful pass.

The file compiled. It called the function. It even contained assertions. None
of them were ever evaluated, and the exit code cannot tell the difference.

This is a *cheap pass* — a way to satisfy the gate without doing the work — and
it is the kind I find most interesting, because nobody wrote it deliberately.
The run stage now counts the tests each framework reports and requires at least
one.

## 5. The type checker checking a file nobody wrote

Last week, adding support for a second test runner. First end-to-end attempt:
every candidate failed with a page of type errors.

```
Parameter 'id' implicitly has an 'any' type.
Cannot assign to 'stryMutAct_9fa48' because it is a function.
```

Nobody wrote `stryMutAct_9fa48`. The mutation tool instruments the source it
mutates, wrapping every expression in guards it declares itself. The TypeScript
transform for that test runner type-checks by default. So it was type-checking
the mutation tool's instrumentation and failing the whole run.

Transpile-only fixes it and costs nothing, because the pipeline type-checks in
a stage of its own and the mutation tool type-checks the mutants separately.
Two type checks remain. The redundant third was the one breaking everything.

## 6. The guard that could not fire

This one is mine alone, with no third-party component to blame.

I built a thermal back-off: if the median generation rate over a rolling
two-minute window drops more than 30% below the benchmark baseline, give up a
worker slot. Reasonable rule. Unit tests, all green.

Re-reading it later, I noticed the "has the window been two minutes long" check
asked whether the *retained* samples spanned two minutes — and the window
filter has already discarded everything older than two minutes. So the retained
span is whatever the sample spacing happens to make it. At roughly 25 seconds
per sample, the oldest retained sample is 100 seconds old, the check never
passes, and **the guard could not fire at all.**

It had a full suite of passing tests. They fed samples on a tidy grid that
landed exactly on the boundary.

There is no external system to blame here. I wrote a check, I wrote tests that
confirmed it, and the tests confirmed it because I generated their inputs from
the same mental model that produced the bug.

## The pattern

Five of these six produce a number that is **plausible, precise, and about
something other than what you think**. None of them throws an error. None
leaves a stack trace. In every case the reported figure is exactly what you'd
predict if your hypothesis were true — which is why they survive review.

The asymmetry is what makes them dangerous. A crash gets fixed on the day. A
survival rate of 3/20 gets written into a table, then a conclusion, then a
decision about which model to use.

## What actually catches them

**Read the discarded outputs. Not a sample — individual files, in full.** All
six were found this way. A discard rate is worth nothing until you have looked
at what was discarded, and the aggregate is specifically the view that makes
fifteen identical failures look like a distribution.

**Ask what your check does when its subject is absent.** The determinism check
passing on empty strings is the cleanest example. "Five identical outputs"
sounds like a strong property until the outputs are empty. Any check that can
be satisfied vacuously eventually will be.

**Suspect the result you were expecting.** Every one of these arrived wearing
the shape of my prior. The on-device model failing, the small model failing at
Swift, the older framework outperforming the newer one — all confirmations, all
wrong. I have no clever method for this beyond noticing when I stop asking
questions, which tends to be precisely when the answer agrees with me.

**Keep the raw artefacts.** Every candidate, every verdict, every prompt is on
disk under a run id. Five of these were diagnosed after the fact from files
still sitting there. A pipeline that only keeps its summary cannot be
re-examined, and the re-examination is where all of this came from.

**Write down the negative results with the same care as the positive ones.**
Each of these is in the project's decision record with its mechanism, the
evidence, and what it changed. That is partly so I don't rediscover them — and
mostly because a project whose write-up contains no mistakes is a project whose
write-up cannot be checked.

---

*From roughly two weeks of building a local-model test-generation pipeline in
September 2026. Six findings across four third-party components and one of my
own. The count is 6 and it is not finished: the first real run of a new
component has found one of these four times out of four so far.*
