# How I cut our deploy time by 80%

Last quarter our deploys took 25 minutes. Today they take 5 — no new hires, no new tools. Here is exactly what changed.

## The problem

Every stage ran one after another. The headline numbers:

| Env | Time |
|-----|------|
| Old | 25m  |
| New | 5m   |

## The old pipeline

One long chain, where each step waited on the last:

```mermaid
graph LR
  A[Push] --> B[Lint] --> C[Test] --> D[Build] --> E[Deploy]
```

## The fix

The real cost was **sequential steps** that could safely run in parallel. One change to the test job did most of the work:

```js
// split the suite into shards and run them at once
const shards = splitTests(suite, 4);
await Promise.all(shards.map(runShard));
```

## The results

Stage by stage, here is where the time actually went:

| Stage | Before | After | Improvement | Notes              |
|-------|--------|-------|-------------|--------------------|
| Lint  | 4 min  | 1 min | 75% faster  | cached deps        |
| Test  | 15 min | 3 min | 80% faster  | 4 parallel shards  |
| Build | 6 min  | 1 min | 83% faster  | incremental builds |

---

Even our flakiest tests calmed down once each shard ran in isolation.

## What we changed

- Split the test job into 4 shards
- Cached dependencies between runs
- Moved linting off the critical path

## Your turn

Faster feedback, happier engineers, and shipping on a **Friday** without fear.

What is the one bottleneck slowing your team down? Follow for more field notes.
