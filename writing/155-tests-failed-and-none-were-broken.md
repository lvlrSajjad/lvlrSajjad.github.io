---
layout: writing
permalink: /writing/155-tests-failed-and-none-were-broken/
title: "155 tests failed, and none of them were broken"
description: "A verification gate returned a detailed, specific, well-evidenced failure. It named the tests. It was wrong, and nothing in its output could have told me so."
date: 2026-09-18
---

*The gate said 155 tests regressed. It named them. The diff was confined, the
compiler was clean, and the failure looked exactly like the kind of bug the gate
exists to catch. Then I ran the identical code again and it passed.*

I build a thing that farms small code changes out to a local model and only shows
me what survived a gate a machine can run. The gate is the whole idea. A weak
model is allowed to attempt work it could not otherwise be trusted with, because
nothing reaches me until the compiler and the project's own test suite have both
agreed the change is behaviour-preserving.

So the gate's verdict is the product. Everything else is plumbing.

Yesterday the gate produced a verdict I want to describe carefully, because I
have been thinking about failure modes in the wrong place.

## What it said

One task: rename a symbol inside a single module file and update its references.
The candidate came back, the gate ran, and the verdict was a failure:

- the diff was **confined** — nothing outside the file was touched;
- the compiler was **clean** — no new type errors anywhere;
- the suite **regressed** — 155 tests that passed before now failed.

All 155 were in one spec file. That is a coherent story, and an experienced
reader will already have written it: a renamed identifier that the compiler
cannot see, because the framework resolves it at runtime by string token.
Dependency injection does this constantly. The compiler is happy, the app is
broken, and only the tests notice. It is close to the canonical example of why
you run the suite instead of trusting `tsc`.

I believed it for about four minutes.

## What was actually true

The run retried the task. Same worker, temperature zero. The retry survived.

I hashed both candidates. Byte-identical — the same `sha256` over the edited file
contents, both times. Same input, same code, two different verdicts.

Later that afternoon I threw the run away and restarted it from scratch on a
quiet machine, with a rebuilt binary. It reached the same task and passed it on
the first attempt, and the candidate hashed to the same value a third time. So:

| | machine | verdict |
|---|---|---|
| morning, first attempt | swapping 5.3 GB | **failed**, 155 regressed |
| morning, retry | swapping | survived |
| afternoon, fresh run | quiet | survived |

One failure in three evaluations of identical bytes, and it is the one taken
while the machine was paging to disk. That rules out the explanations a single
retry leaves open — a flaky spec file would not wait for memory pressure to fail,
and the two runs used different binaries. It also says something I was not
looking for: the local model emitted the same bytes hours apart, which is the
determinism the whole design assumes and rarely gets to check by accident.

The machine was thrashing. Thirty-two gigabytes of RAM, fifteen of it compressed,
five of six gigabytes of swap in use. The suite had not detected a defect. The
suite had timed out, and a timed-out test reports as a failed test.

## The part that should worry you

Go back and read the verdict again. It is not vague. It is not a warning. It
names 155 specific tests, in one file, with a confined diff and a clean compile.
There is no field in it that is wrong.

**And there is no field in it that could have been right.** The verdict records
what the gate observed, and what it observed genuinely happened: those tests ran,
and they failed. Nothing available to the gate distinguishes "these tests failed
because the change broke them" from "these tests failed because the machine ran
out of memory." Not the confinement check, not the compiler, not the test runner,
not the count, not the names.

The only thing that separated the false verdict from a true one was running the
identical candidate a second time and getting a different answer.

That is a bad property for a verdict to have. It means the gate does not fail
loudly when it is unreliable — it fails *closed*, silently, producing exactly the
output it produces when it is working perfectly.

## I had already written this down, one level up

This is the part I find genuinely uncomfortable.

Six phases earlier I hit the same mechanism from a different direction. I was
using peak resident memory as an input to a sizing decision, and I measured that
under memory pressure a model's peak RSS *falls* — macOS compresses and evicts
pages, so the number that is supposed to tell you how much memory something needs
goes down precisely when the machine cannot supply it. I wrote a decision record
about it with a sentence I was rather pleased with:

> Peak RSS cannot detect the condition that invalidates peak RSS.

And the fix was correct: stop trusting free-memory counts, and ask the kernel for
its own pressure level instead, because that is the number that knows.

I wired that check into the place where a worker process starts up. I did not
wire it into either of the two places that run the gate.

So the worker politely refuses to start on a starved machine, and then the gate
runs on one without ever asking. The run even logged its reasoning: *"17.6 GB
free ÷ 6.5 GB per slot."* That number was high **because** the machine was in
trouble. The instrument read the symptom as headroom.

The sentence I was pleased with generalises, and I missed where:

> A gate verdict cannot detect the condition that invalidates a gate verdict.

**The guard was not missing. It was unfinished** — written, documented, justified,
and connected to one of the three call sites that needed it. I think that is a
meaningfully worse state than absent, because a guard that exists stops anyone
looking for it. I certainly stopped.

## Why it bends results in one direction

I found this in the middle of an experiment comparing four configurations:
a frontier model alone, a cheaper frontier model alone, my tool, and the gate
applied to the frontier model's own output.

Two of those four run the project's test suite. Two do not.

So contention on the machine **cannot** affect the ungated arms and **can only**
hurt the gated ones — by inventing failures. A loaded laptop makes the gate look
stricter than it is, and a report written from those numbers says *"the tool
rejects changes that were perfectly fine."* That is a conclusion about the tool,
manufactured by the laptop it ran on.

Any experiment that compares a verified arm against an unverified one on a shared
machine has this exposure built in, whether or not anyone notices. I nearly
didn't.

## The obvious fix is wrong, and I know that only because I measured

The tempting move is to make the gate pressure-aware: if the kernel reports
memory pressure, don't record a test failure as a real failure — record it as a
machine failure and exclude it from the denominator.

I built the measurement side first: a sampler that records pressure, free memory,
swap and compressed memory every twenty seconds for the whole run, so a suspect
verdict can be checked against the machine's state at the moment it was taken.
Not a guard. Just a record.

It answered the question in three minutes.

The restarted run began on a quiet machine — eighteen gigabytes free, pressure
normal, nothing else running. **The test suite alone drove it to `warn` in a
hundred seconds.** Free memory collapsed into the compressor. Swap did not move.

That is the suite's ordinary operating point. Six thousand tests and a resident
seven-billion-parameter model do not fit in thirty-two gigabytes with room to
spare, so the kernel compresses, says `warn`, and everything works fine. If I had
shipped the obvious fix, it would have reclassified nearly every genuine test
failure on this hardware as a machine failure — the same bug with the sign
flipped, and much harder to notice, because it would make the tool look *better*.

The condition that actually broke a verdict was not `warn`. It was **sustained
swapping**, which is a delta against the run's own floor, not a level. The
morning's false negative happened at 5.3 GB of swap; the healthy run sat at 2.5
and never grew past 3.0.

A threshold written from intuition yesterday would have been wrong. A recorder
written yesterday would have found it on its first run.

## What I actually take from this

**Record before you gate.** When you do not yet know where a threshold belongs,
an instrument that observes and changes no decision is strictly better than a
guard set by intuition — it cannot bias anything, and it is how you learn where
the threshold goes. Gating is a claim that you already know.

**Check where your guards are wired, not whether they exist.** Everything in this
story was already understood. The mechanism was documented, the right signal was
identified, the code was written. It was connected to one of three places, and
the other two ran for six phases without it.

**Be suspicious of your most detailed failures.** I would have caught a vague
error immediately. What got through was specific: named tests, a clean compile, a
confined diff, and a plausible mechanism I supplied myself within seconds of
reading it. The verdict was detailed enough that I stopped asking whether it was
true.

I am also fairly sure this is not unique to me. If you run a verification suite
on the same machine as the thing it verifies — CI runners, pre-commit hooks,
anything with a model resident in memory — your gate has some rate of silent
false negatives, and by construction it will never tell you what that rate is.

I can't tell you mine either. I know it is not zero, because I caught one, and I
only caught that one because the retry happened to disagree with itself in front
of me. Four tasks had run at that point. I am not going to turn that into a
percentage; the honest version is that the rate is unmeasured, it was unmeasured
for six phases, and the instrument that would measure it is twenty lines long and
I wrote it the same afternoon.
