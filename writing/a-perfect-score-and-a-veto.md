---
layout: writing
permalink: /writing/a-perfect-score-and-a-veto/
title: "A perfect score, and a veto"
description: "I froze a decision rule before the tool had produced a single number, including one clause I thought was ceremony. The first result came back perfect on the metric and failed on the clause."
date: 2026-09-17
---

*The rule was written on a Wednesday, before the thing it judges had produced a
single verdict. On Thursday it returned a perfect score and I had to call it a
no-go. That gap is the entire point of this note.*

There is a move everyone in machine-learning evaluation makes and almost nobody
admits to: you run the experiment, you look at the number, and *then* you decide
what would have counted as success. It never feels like cheating. It feels like
judgement — like you are finally in a position to say what the number means.

It is cheating. A rule written after a number is a description of that number.

So on the workload I am building now, I wrote the decision rule first. Not
"first" in the sense of before the analysis: first in the sense that the code
being judged had never once run end to end, and no survival rate for it existed
anywhere, in my head or on disk. Then I froze the file and put a line at the top
saying it must not be edited — that anything learned about the rule gets appended
below it, dated, so the run stays readable against the rule that was in force
when it ran.

I want to describe what that bought, because it was not what I expected, and it
arrived within a day.

## The thing being measured

The system takes a small, well-specified code change — rename this symbol,
remove this unused import, guard this value — hands it to a 7B model running on
my laptop, and refuses to show me the result unless it survives a gate a machine
can run:

```
survives  ⇔  the diff was confined to the files the task named
          ∧  the type-checker is clean, with no errors introduced anywhere
          ∧  every test that passed before still passes
```

That gate is free, because the user already wrote it. It is their test suite and
their compiler. Nothing about it is my opinion. And it is genuinely strict: seven
named cheap ways to pass it are blocked by name, each with a control committed
next to the code that proves the gate rejects it — adding `@ts-ignore`, widening
a type to `any`, editing the test file, editing the build config, deleting the
offending line, changing a file the task did not list, changing nothing at all.
Four of those seven satisfy the type-checker *completely*. Only the confinement
check stands between them and a pass, which is exactly why they are enumerated
rather than assumed away.

That is a gate I trust. The question this note is about is what a gate like that
cannot see.

## The clause I thought was ceremony

The frozen rule has the shape you would expect. Let **S** be the survival rate —
the fraction of tasks that get through the gate. The local model has to reach
0.90 of what a network model reaches on identical inputs, and clear an absolute
floor, and cost zero tokens.

Then there is a second quantity, **A**, and I nearly did not include it:

> **A(x)** = the blind approval rate. Of a sample of *x*'s survivors, the
> fraction that a reviewer, shown the diff and the ask and **not** told which
> configuration produced it, says they would have accepted as the change.

with a sentence underneath that I wrote in a slightly defensive tone, the way you
do when you suspect you are gold-plating:

> The approval guard is a veto, not a tiebreak. Below it, every other cell
> collapses to no-go.

My honest expectation was that A would come back at or near 1.0 for everything
that survived, that I would report it in a table, and that it would never bind.
The gate is strict. Survivors compile and keep a real test suite green. What
exactly was going to be wrong with them?

I included it anyway for a boring, procedural reason: on the previous workload, a
survival rate alone had already failed once to distinguish "passed" from "passed
by not doing the thing." A control model had cleared a test-writing task by
writing a test that never asserted the behaviour the planted bug lived on. Green,
useless. I had needed a second axis then, and I had had to invent it afterwards,
which is the thing I am trying to stop doing.

## What came back

The first end-to-end result, on a small fixture with three planted type errors:

| | survival rate | blind approval |
|---|---|---|
| local 7B | **3/3** | **1/3** |
| network control | **3/3** | **3/3** |

A perfect survival rate. Identical to the control. Zero tokens spent on the
worker. On the primary metric this is not a marginal pass, it is the best result
the experiment can produce — and if the rule had been written on Thursday instead
of Wednesday, I am fairly confident I would have found a reason why approval was
a nice-to-have.

Here is one of the diffs that survived. The ask was: *fix every TypeScript error
in these files without changing what the code does.*

```diff
 import { subtotal, type Line } from "./money";

-/**
- * Planted error #3 — **TS2345**, a `string` where `toFixed` wants a `number`.
- *
- * The obvious fix — retype `places` as `number` — moves the error into
- * `report.test.ts`, which calls this with `"2"`. That is deliberate: the gate
- * refuses a change that introduces an error anywhere else, so this task can
- * only be survived by a fix that stays inside the file.
- */
 export function renderTotal(lines: Line[], places: string): string {
-  return `Total: ${subtotal(lines).toFixed(places)}`;
+  return `Total: ${subtotal(lines).toFixed(parseInt(places, 10))}`;
 }
```

The fix is correct. `parseInt(places, 10)` is a fine answer; it type-checks, the
suite stays green, the behaviour is identical. And on the way past, the model
deleted the seven-line docblock.

It did that in two of three tasks. The network control did it in none.

## Why the gate could not see it

This is the part worth generalising, because it is not a bug.

The gate's definition of "behaviour-preserving" is *the tests still pass and the
types still check*. A docblock is neither a test nor a type. It is invisible to
both, by construction. The gate was not fooled and did not malfunction — it
returned a correct answer to the question it was asked, and the question did not
cover documentation.

I even had a rule that looked like it should have caught this. Each task carries
a deletion budget, defaulting to zero, so that "delete the failing line" is not
an available strategy. But the function that counts deleted lines deliberately
skips comments, and its own docstring explains why:

> Deliberately crude, and the crudeness is safe in one direction only. It cannot
> mistake code for a comment, so it never *under*-counts a deletion of real code
> — which is the direction that matters […] the worst that does is refuse a
> candidate that deleted a comment, which is not a fix.

The reasoning is sound and the conclusion is exactly backwards. The author — me —
worked out that the error mode was *refusing* a comment-deleting candidate, and
shipped. The actual error mode is *admitting* one. I read that docstring twice
during the run before I noticed it was describing the opposite of what the code
does.

So: a strict gate, seven Goodhart controls, an enumeration I was proud of, and an
eighth way through that none of it covers. The prompt even forbids the behaviour
in plain English — *"Do not reformat, rename, reorder or tidy anything else"* —
which is worth nothing, because a prompt is a request and a gate is a
constraint, and the model is optimising against the second one.

## What the veto is actually for

The reviewer in this experiment is blind: it gets the diffs in one shuffled pass,
labelled with opaque ids, with no way to tell which model produced which. It
independently rejected exactly the two documentation-deleting diffs and accepted
the other four, including the functionally identical fix from the other model
that left the comment alone. It was not looking for the thing I had failed to
enumerate. It just would not have approved the change.

That is the property I want. **A mechanical gate can only refuse the failures you
thought of.** The enumeration is doing real work — four of my seven controls pass
the type-checker outright and would otherwise ship — but the enumeration is
finite and the ways to be unhelpful are not. A blind human-equivalent judgement,
sampled and reported as a number, is how you find out what your enumeration is
missing. It does not replace the gate. It audits it.

And it has to be a **veto**, not a term in a weighted score, for a reason that is
easy to state and easy to rationalise away in the moment: *a worker that gets
changes past the gate that a reviewer would not have accepted is worse than a
worker that gets nothing past it, because the second kind of failure is visible.*
A zero survival rate is a bad afternoon. A high survival rate full of quietly
damaging changes is a tool that erodes a codebase while reporting success.

## The honest size of this result

Three tasks. One fixture — code I wrote, in a project I configured, with errors I
planted. A(local) = 1/3 has a 95% confidence interval running from roughly 0.008
to 0.906, which is to say it is barely a measurement at all. On the previous
workload the same fixture overstated real-world performance by more than a
factor of two, and I have no reason to think this one is kinder.

The numbers that will mean something are from two large commercial TypeScript
codebases — one Nest, one React — neither written by me, neither modified to make
this work. Both are big enough that a single pass of the gate takes about five
minutes of wall clock per candidate, almost all of it the projects' own test
suites, which is its own finding: on a real repository the expensive half of this
design is not the model.

I did not know what they would say. They have since run, and the answer is worth
recording next to the prediction: on both codebases the local model survived the
gate at 12 of 12 and 11 of 12, and on both the blind approval rate came in at 9 of
10 against the control's 10 of 10 — passing the frozen bar by a margin of exactly
zero, twice.

The rejected diff each time was the same species as the fixture's. On one project
it reworded a doc comment while renaming; on the other it inserted a stray blank
line while deleting an import — and that one's control twin made the identical
deletion *without* the extra line, which the blind reviewer caught and split
without knowing which was which. Across all three inputs: four of twenty-three
sampled changes rejected for unrequested tidying, against zero of twenty-three for
the network model.

Two things I did not expect. **The survival rate turned out to be useless as a
discriminator** — five of six measurable cells sat at or above 0.917, so the
rule's ratio clauses could not separate anything, and the entire decision rested
on the clause I had nearly cut. And **both projects landed on exactly 0.900
against a 0.900 bar**, which is not a coincidence: with a ten-item sample the rate
moves in steps of 0.1, so landing precisely on the threshold is the *most likely*
way to pass. The sample size and the bar interact, and I had not thought about
that when I wrote either of them.

## The transferable part

Three things, in the order I would now rank them:

**Write the rule before the number exists, and make it unreachable.** Not "decide
in advance roughly what good looks like" — commit the thresholds to a file, put a
line at the top saying it is frozen, and require amendments to be appended below
with a date. The value is not the discipline. The value is that you will
eventually want to change it, and the wanting is the signal.

**Put at least one clause in it that you expect never to bind.** The clauses you
are confident about are the ones encoding what you already believe. The one that
felt like gold-plating is the one that caught this.

**Then read the outputs.** Every finding here came from reading a diff that the
system had already marked as a success. Survival rate said 3/3. The funnel said
3/3. Everything I had built to summarise the run said the run was perfect, and it
took about ninety seconds of looking at the actual text to see that a third of
the documentation in the changed files had quietly gone.

The summary statistic is what you build so you do not have to read everything.
That is exactly why it cannot be the thing that tells you it is wrong.
