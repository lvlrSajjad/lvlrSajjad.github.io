---
layout: writing
permalink: /writing/a-verifier-beats-a-bigger-model/
title: "A verifier beats a bigger model"
description: "A 7B model on a laptop wrote unit tests at 0.85 of Claude Haiku's survival rate for zero API tokens — and the 14B, which cost twice the time and twice the memory, did not do better. Measured, with the decision rule written down first."
date: 2026-09-15
---

*Measured on an M2 Pro. The decision rule was frozen before the run, and it has
a hole in it that the result fell straight into.*

Here is a claim that sounds like wishful thinking: a 7-billion-parameter model
running on a laptop can do useful software engineering work, if you put a
machine between it and you that throws away everything it gets wrong.

I built the machine to find out. This is what it measured, including the parts
that did not go the way the design said they would.

## The setup

The tool is called sidecrew. The job is unit tests for existing code. Claude
Opus reads a module and writes a plan — which functions are worth testing,
which *kinds* of question to ask about each one, and one worked example per
kind. Small models running locally under MLX write the actual test files. Then
a gate decides what a human ever sees:

> A test **survives** if it compiles, passes against the unmodified source,
> kills at least one mutant of the function it claims to test, and is not
> tautological.

"Kills a mutant" is mutation testing. The verifier deliberately corrupts the
function — flips a `<` to `<=`, deletes a return, inverts a condition — and
checks that the candidate test notices. A test that passes both the real code
and a broken copy of it has not tested anything.

The point of the gate is that it converts a soft question — *is this a good
test?* — into a mechanical one the machine can answer without help. If it
works, model quality stops mattering as much as everyone assumes, because the
bad output never reaches a person.

## The experiment

Two fixtures: 14 TypeScript functions in 20 tasks, and 10 Swift functions in 18
tasks. Identical plans and exemplars across every configuration. Four workers:

| | |
|---|---|
| **C1** | Apple Foundation Models, on-device, via a community shim |
| **C2** | Qwen2.5-Coder-7B, 4-bit, MLX, on the laptop |
| **C2b** | Qwen2.5-Coder-14B, 4-bit, same machine |
| **C3** | Claude Haiku, over the network — the control |

Temperature 0, seed 42, pinned model revisions, one request in flight per
worker process. Xcode and two simulators open throughout, because that is the
machine this is meant to run on.

**The decision rule was written down and frozen before the first token.** GO if
the local model reaches 90% of the control's survival rate. GO-WITH-14B if it
lands in 75–89% *and* the bigger model clears 90%. NO-GO below 75% if the
bigger model doesn't rescue it. I mention this now because it matters later.

## The numbers

Survival rate — tasks that made it through all four conditions of the gate:

| worker | TypeScript (20) | Swift (18) |
|---|---|---|
| Apple Foundation Models | 3 · **0.15** | 0 · **0.00** |
| **Qwen2.5-Coder-7B** | 17 · **0.85** | 4 · **0.22** |
| Qwen2.5-Coder-14B | 17 · **0.85** | 2 · **0.11** |
| Claude Haiku (control) | 20 · **1.00** | 14 · **0.78** |

Median wall clock per candidate, end to end: the 7B took 14.6 s on TypeScript
against Haiku's 27.5 s. API tokens spent on generation by the three local
configurations: **zero**, enforced by the data contract rather than asserted —
a run that records itself as local and reports nonzero worker tokens does not
serialise.

## The 14B is never the right trade

This was the result I expected least. The received wisdom is that a bigger
local model buys you accuracy at the cost of speed, and you choose your point
on that curve.

On TypeScript the 14B scored **the identical 17/20**, failing the identical
three tasks. On Swift it was **worse** — 2/18 against the 7B's 4/18. For that
it charged 2.2× the generation time (11.8 s against 5.3 s median) and 8.2 GB of
memory against 4.5 GB, which on a 32 GB laptop is the difference between
running two workers and running one.

There is no trade-off here to be on the right side of. On this evidence the
bigger model is simply a worse choice, and I would not have believed that
without running it.

## Swift failed, and the reason was not syntax

Swift is a clean no-go: 0.29 of the control. Thirteen of eighteen candidates
never compiled.

Reading the failures is what made it interesting. Every function in the Swift
fixture is a static member of an enum — `Numbers.percentChange`,
`Arrays.zipShortest`. The prompt carries the function's own source, sliced out
of its enclosing type, plus `@testable import SwiftFixture` as an import hint,
plus an exemplar that calls `Numbers.clamp(...)` in plain sight.

Haiku reads that and writes `Numbers.percentChange(...)`.

The 7B writes `SwiftFixture.percentChange(...)` — it reaches for the module
name from the import hint. Same prompt, same information, opposite outcome.
That is a capability difference, not a missing instruction.

So I added the missing instruction anyway, after the run was frozen, to see how
much of the gap it was: render the qualified name when the plan has one.
Measured, same tasks, same seed: Swift went from 4/18 to **9/18** through the
full pipeline, and compiles from 5 to 14.

It is still a no-go. 0.500 against Haiku's 0.778 is 0.64, short of the 0.75
floor. The largest single cause of the collapse is gone and the language still
does not clear the bar. What's left mostly fails at the *pass* stage — Swift
that builds and asserts the wrong answer.

That change ships conditionally, incidentally: the clause renders only when the
signature is qualified with an owner. On TypeScript's unqualified signatures it
repeats what the prompt already said, and the measurement was that redundancy
is not free — TypeScript went 17 → 16 with the line always on.

## The rule had a hole and TypeScript fell into it

TypeScript scored 0.85. That is in the 75–89% band, whose escape hatch is "the
14B clears 0.90". The 14B scored exactly 0.85.

So: in the band, with the bigger-model branch *refuted* rather than confirmed,
and no named outcome covering it.

Rounding up to GO would be picking the verdict after seeing the data, which is
the one thing writing the rule down first is meant to prevent. Rounding down to
NO-GO would throw away a configuration that reached 0.85 of a network model for
zero tokens and half the latency.

I recorded it as a gap. The frozen protocol file is still byte-for-byte
unedited, so the run stays readable against the rule that was actually in force
when it ran, and the resolution sits below it with a date on it.

The resolution needed a second axis, and the run had already produced the
argument for one.

## The result that says survival rate is not enough

Haiku's 20/20 on TypeScript includes a task called `truncate:boundary`. The
fixture has a planted off-by-one in `truncate` — it uses `<` where it needs
`<=`, so it gets exactly one input class wrong: when the text is exactly
`maxLength` long.

Haiku's test asserts `truncate("", 5)`, `truncate("A", 2)`, `truncate("text",
0)` and `truncate("ABC", 2)`. It never asserts the case the bug lives on. It
survives because it agrees with the bug.

The 7B **failed** that task, twice, by asserting the correct answer.

On that task the gate rewarded the model that avoided the question the plan
asked it. And it is not an isolated flourish: across the TypeScript fixture,
the 7B's survivors have a median mutation score of **1.00** against Haiku's
**0.917**. The configuration that survived less often wrote the sharper tests
when it survived.

So the fourth cell of the rule is **CONDITIONAL GO**, and it carries a guard:
it holds only while the local model's survivors score no lower than the
control's on mutation. In the band *and* blunter than the control is a no-go,
because that would mean the local tier is surviving less often *and* writing
weaker tests when it does.

The 0.90 bar did not move. A bar that relocates to wherever the result landed
is not a bar.

## What I would tell someone considering this

**Verification changes what model you need, but not as much as I hoped and not
uniformly.** TypeScript at 0.85 of a network model for zero tokens is a real
result. Swift at 0.64 after the best fix I found is a real non-result. Same
pipeline, same gate, same day.

**Check the failures before you believe the rate.** Two of the four
configurations in this experiment produced a number that was about my
infrastructure rather than about the model. The first TypeScript run scored 0/6
because the serving layer streamed an end-of-turn token as content and the
fence stripper missed it. The Apple Foundation Models run scored 0/20 because
the shim's streaming endpoint returns no content at all, and the determinism
check passed 3/3 on empty strings. Both looked exactly like a model that cannot
write TypeScript.

**Write the decision rule down before you run anything.** Not because it stops
you being wrong, but because it makes you notice when the result doesn't fit —
which is the moment you're most likely to quietly redefine success. Mine had a
hole in it and the result landed in the hole. That was the most useful thing
the experiment did.

---

*Numbers from the go/no-go run of 14 September 2026 on an M2 Pro / 32 GB, macOS
26.6.2, mlx_lm 0.31.3, Swift 6.3.3, muter 16. Every figure is recorded with the
machine it came from and flagged as measured rather than estimated. n = 1 per
cell: 20 and 18 tasks, one seed, one machine. TypeScript's 0.85 is three tasks
and Swift's 0.22 is four — a two-task difference is not a ranking, and I have
tried not to treat it as one.*
