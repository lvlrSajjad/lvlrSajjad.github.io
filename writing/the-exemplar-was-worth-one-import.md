---
layout: writing
permalink: /writing/the-exemplar-was-worth-one-import/
title: "The exemplar was worth one import line"
description: "I built a system around the idea that a worked example is what makes a small model usable. Then I ran the ablation that was supposed to confirm it, and 4 of 20 became 16 of 20 on a single sentence about an import statement."
date: 2026-09-15
---

*An ablation that refuted the premise of the thing it was testing, and why the
feature shipped anyway.*

The design rests on a claim from the literature and from my own intuition:
small models are weak at generating code from a specification, but good at
*imitating a worked example*. So give the worker one perfect example of each
kind of test you want, and it will copy the shape.

Everything in the system follows from that. The planner's most expensive job is
writing exemplars. Each exemplar has to survive the verifier itself before a
plan is considered valid. The prompt is built around fitting the exemplar into
a small context window, and there is a token budget on the instructions
specifically so they cannot crowd it out.

Then I measured it.

## The ablation

Twenty tasks over the TypeScript fixture. Qwen2.5-Coder-7B, 4-bit, MLX, on an
M2 Pro. Temperature 0, seed 42, no retry — first-attempt survival only, so the
number is about the wording and not about a second chance.

Three variants, which is what I planned:

- **bare** — the function's source, the import hint, the shape and its rules.
- **+ exemplar** — the same, plus a complete worked test file.
- **+ exemplar + rules** — the shipping prompt.

| variant | survived | compiled | median score of survivors | completion tokens | generate |
|---|---|---|---|---|---|
| bare | **4/20** | 5/20 | 0.93 | 248 | 7.7 s |
| + exemplar | 15/20 | 20/20 | **1.00** | 218 | 6.9 s |
| + exemplar + rules | **17/20** | 20/20 | **1.00** | **150** | **5.3 s** |

4 → 15 on adding an exemplar. That is the result I was expecting, and if I had
stopped there I would have written a confident post about how worked examples
unlock small models.

## Reading the failures

The habit that saved this was reading the discarded candidates instead of the
summary. **Every one of bare's fifteen compile failures was the same missing
line:**

```ts
import { describe, it, expect } from "vitest";
```

Exactly the five candidates that included it are the five that compiled.

Nothing about structure. Nothing about assertion style. Nothing about the
*shape* of a boundary test versus a happy-path test. The bare prompt told the
model how to import the function under test and never mentioned that the test
framework also needs importing, and fifteen times out of twenty a 7B did not
infer it.

The exemplar fixed that — because an exemplar is a complete file, and a
complete file has the import at the top.

So the question became: is the exemplar doing the work the design claims, or is
it delivering one line by accident?

## The fourth arm

I added a variant after seeing the first result, which is a thing to declare
rather than hide. It is the bare prompt plus one sentence: *import the test
framework.* No example.

| variant | survived | compiled | median score | completion tokens | generate |
|---|---|---|---|---|---|
| bare | 4/20 | 5/20 | 0.93 | 248 | 7.7 s |
| **bare + one sentence about the import** | **16/20** | **20/20** | 0.93 | 258 | 9.6 s |
| + exemplar | 15/20 | 20/20 | 1.00 | 218 | 6.9 s |
| + exemplar + rules | 17/20 | 20/20 | 1.00 | 150 | 5.3 s |

**One sentence scores 16. The full worked example scores 15.**

The 4 → 15 that reads like *the exemplar makes a 7B usable* is, on this
fixture, the exemplar happening to carry an import nobody thought to ask for.
A sentence costing nine words does it slightly better.

## Why it still ships

The shipping prompt keeps the exemplar. Three honest reasons, and they are not
the reason I originally had.

**Survivor quality.** The exemplar arms score a median mutation score of
**1.00** against 0.93 without. Survival is a filter; the mutation score is how
sharp the surviving test is. The exemplar arms write tests that kill every
mutant of the function, and the others leave some alive.

**Cost.** 150 completion tokens against 258, and 5.3 s of generation against
9.6 s. The model that has been shown what the answer looks like writes less and
stops sooner. Over a real codebase that compounds.

**The claim was never really tested.** The fixture is fourteen small pure
functions — `truncate`, `median`, `countOccurrences`. The thing exemplars are
supposed to be for is code with mocks, setup and lifecycle, where a worker has
to copy structure it cannot possibly derive from a signature. This fixture has
none of that. What I measured is that on trivially-shaped code, an exemplar is
worth about one import statement. That is a real finding about this fixture and
not a refutation of the general claim.

So the honest summary in the project's own docs is: *the exemplar is kept for
survivor quality and token cost, which are measured, rather than for survival
rate, which is not.*

## The caveat that matters most

16 / 15 / 17 is one or two tasks at n = 1. One seed, one machine, one fixture.
A two-point difference between variants is not a ranking and I have tried very
hard not to write as though it were.

What *is* solid is the 4, and what it was made of. Fifteen identical compile
failures is not noise.

## What transfers

**Run the ablation you think you already know the answer to.** The arm that
mattered — one sentence about an import — did not exist in my plan, because the
plan was built by someone who already believed the conclusion. It only got
added because I read the failures.

**A large effect can have a small and boring cause.** 4 → 15 looks like a
capability unlock. It was a missing `import`. The size of an effect tells you
nothing about which mechanism produced it, and the only way to find out is to
look at the individual failures, which is exactly the step an aggregate number
lets you skip.

**Write down what your measurement does not cover.** The sentence *"this
fixture has no mocks, setup or lifecycle, so it cannot test the claim exemplars
exist for"* is worth more than the table above it. It stops a future reader —
usually me — from citing this result for something it never measured.

**Keeping a feature for different reasons than you built it for is fine.** The
exemplar survived its own refutation and now has two measured justifications
instead of one assumed one. That is a better position than it was in before.

---

*Numbers from `prompt-ablation-2026-09-14.json`, M2 Pro / 32 GB, macOS 26.6.2,
mlx_lm 0.31.3. Every figure recorded with the machine it came from. The shipped
prompt is pinned byte-for-byte to the winning variant by a test, so editing the
wording without re-running the ablation fails the build — which is the only way
I have found to stop a measured artefact drifting back into a matter of taste.*
