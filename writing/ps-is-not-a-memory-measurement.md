---
layout: writing
permalink: /writing/ps-is-not-a-memory-measurement/
title: "ps is not a memory measurement"
description: "macOS reported 205 MB of resident memory for a model whose weights are 4 GB, while the machine held 9.5 GB of swap. Under memory pressure every number you would reach for moves the wrong way — including the free-memory count you would use to decide whether there is a problem."
date: 2026-09-15
---

*Three measurements that were confidently wrong in the same direction, and the
check that catches them.*

I spent a while this month building something that runs large language models
on a laptop next to Xcode. The binding constraint is memory: a 4-bit 7B model
is about 4.5 GB resident, a 14B is about 8.2 GB, the machine has 32 GB, and an
iOS simulator is not shy.

So I needed to answer two questions honestly. *How much does this model
actually cost?* And *is there room to start another one right now?*

Both answers turned out to be made of numbers that lie under exactly the
conditions you need them.

## Measurement one: the model that got cheaper as it thrashed

Benchmarking the 14B under two working sets — a quiet machine, and a machine
with Xcode and a simulator open:

| | peak resident (`ps -o rss=`) | swapped out |
|---|---|---|
| quiet machine | 6,947 MB | 0 |
| Xcode + simulator open | **4,364 MB** | **3,197 MB** |

The busy machine reports the model as 2.5 GB *smaller*.

It is not smaller. macOS compresses anonymous memory under pressure, and pages
that get compressed or evicted stop being resident — so resident set size falls
while the machine gets worse. The run that reports a lower footprint is the run
that is thrashing.

This is the shape of the problem: **the metric degrades in the same direction as
the thing it is supposed to detect.** A cost measurement that goes *down* when
the cost goes up is not conservative or noisy, it is actively misleading, and
averaging more samples does not help.

The fix is not a better memory metric. It is a second, independent signal that
says whether the first one can be trusted at all: `vm_stat`'s cumulative
swapout counter, read before and after, differenced.

With a floor on it. A 14B that genuinely did not fit swapped **3,197 MB**; a
14B that fitted comfortably still showed **10.8 MB** of unrelated background
activity, because the counter is system-wide and picks up whatever else the
machine did meanwhile. Flag at "greater than zero" and the warning fires on
noise, and a warning that fires on noise is one people learn to ignore. The
floor sits at 100 MB — between the two measured values, not at a round number
somebody liked.

Every benchmark row now carries the swapout delta and a `trustworthy` boolean.
Rows taken while the machine was swapping are still recorded; they are just
labelled as describing a machine under duress rather than describing a model.

## Measurement two: 205 MB for four gigabytes of weights

Three days later, running a longer experiment on a machine holding 6.6–9.5 GB
of swap throughout, the peak-resident sampler reported:

| model | weights on disk | `ps` peak RSS |
|---|---|---|
| Qwen2.5-Coder-7B-4bit | 4.0 GB | **205 MB** |
| Qwen2.5-Coder-14B-4bit | 7.7 GB | **718 MB** |

205 MB for a model that cannot run in 205 MB. The one plausible figure in the
whole run — 4,835 MB — came from the 14B during a stretch when the machine had
11 GB free.

Same mechanism as before, from the other direction and much further. The
experiment's write-up says, in as many words, that **no peak-RAM claim should
be taken from this run**, and the results files record free memory before and
after each cell instead of a footprint. A missing number is better than a wrong
one, and the difference between the two is entirely a matter of whether anyone
wrote down which they had.

## Measurement three: free memory rises while the machine gets worse

Before starting a model, the gate is: *is there at least the model's footprint
plus 2 GB of headroom free right now?*

Free memory on macOS is not the `Pages free` line — the OS keeps very little of
that. What a model can actually claim is free plus the pages the kernel will
hand over without swapping: inactive, speculative, purgeable. Sum those, and
you get a number that is right on a healthy machine.

Under pressure, the kernel compresses and evicts, and those reclaimable
counters go **up**. The gate gets more permissive exactly as the machine
becomes less able to honour it.

So the gate now asks the kernel directly as well:

```
sysctl -n kern.memorystatus_vm_pressure_level
```

1 is normal, 2 is warning, 4 is critical. At warning or critical the worker
does not start, however much memory is reported free — because "never swap" is
the rule, not "swap a little".

One detail I had to get right and nearly didn't: there is a fourth state,
*unknown*, for a machine where the sysctl is missing or that isn't macOS at
all. Guessing "normal" claims a check that never ran. Guessing "warning"
refuses every run on a machine with plenty of room. Unknown is neither — the
free-memory half still decides, and the explanation says only what was actually
measured.

## The one that came back clean

Having established that I could not trust three different memory numbers, I
went looking for the same problem in throughput, where the literature warned
about thermal throttling on laptops: *sustained batches on an M2 Pro sag; back
off when tokens per second drop.*

I built the back-off, then ran it for 22 minutes of continuous generation to
see it fire.

It did not fire, because the machine did not sag. Median decode rate across 129
requests was **40.5 tok/s** — the benchmark baseline to the decimal — with
five-minute medians of 40.1, 40.5, 40.8, 40.7, 40.1. On mains, with Xcode and a
simulator open. The risk did not reproduce.

But it did not hold perfectly still either, and that part was worth the 22
minutes. Seven consecutive requests at minute four dropped to 31.4, 28.7,
**25.8**, 26.7, 26.7, 30.5 and 32.9 tok/s, and then the machine recovered
completely for seventeen minutes.

Four of those seven are **below the back-off threshold on their own**. The
guard declined, because what it tests is the *median of the trailing two
minutes*, which bottomed out at 30.5 against a floor of 28.3.

A rule reading single samples would have retired a worker slot for the rest of
the run on the strength of ninety seconds that then went away. And it came
within about a minute of firing, which tells me the threshold is not set
absurdly far from what this machine actually does.

That shape — arriving, lasting ninety seconds, leaving — is contention, not
heat. Throttling is progressive and it stays.

## What transfers

**Ask what your metric does when the condition you are detecting is present.**
Not "is it accurate", but "which way does it move". Resident set size, free
memory and compressed pages all move the *wrong* way under memory pressure.
Anything with that property needs a second, independent signal before you can
use it for a decision.

**Calibrate thresholds between two measured values, not at a round number.**
The swap floor sits at 100 MB because a real problem was 3,197 MB and real
background noise was 10.8 MB. I have no defence of 100 beyond "it is between
them, and both are measured", but that is a much better defence than 0 or 1,024
would have had.

**A null result from a long run is worth the long run.** Twenty-two minutes of
continuous generation bought "the risk did not reproduce on mains", which is a
real qualification of the received wisdom, plus a near-miss that showed the
rolling window earning its place on data I did not construct. The alternative
was shipping a guard whose only evidence was a unit test I wrote to make it
pass.

**Write down what you could not measure.** The soak says nothing about
behaviour on battery, which is where macOS throttles hardest and which the
experiment could not arrange. That sentence is in the results file, the
project's decision record and its backlog, because the failure mode I am most
worried about is a future reader — me — citing a mains measurement for a
battery claim.

---

*Measured on an M2 Pro / 32 GB, macOS 26.6.2, mlx_lm 0.31.3, across three
experiments in September 2026. The 205 MB figure is real and is in a results
file with the machine state that produced it, labelled as the reason that run
makes no memory claim at all.*
