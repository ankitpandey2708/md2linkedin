# How I cut our deploy time by 80%

Last quarter our deploys took 25 minutes. Today they take 5. Here is the exact change that made our team more **productive** without adding a single new hire or tool.

The headline numbers:

| Env | Time |
|-----|------|
| Old | 25m  |
| New | 5m   |

Our old pipeline ran every stage in one long chain:

```mermaid
graph LR
  A[Push] --> B[Lint] --> C[Test] --> D[Build] --> E[Deploy]
```

The real cost is **sequential steps** that could safely run in parallel. The fix was one small change to the test job:

```js
// split the suite into shards and run them at once
const shards = splitTests(suite, 4);
await Promise.all(shards.map(runShard));
```

Stage by stage, here is where the time actually went:

| Stage | Before | After | Improvement | Notes              |
|-------|--------|-------|-------------|--------------------|
| Lint  | 4 min  | 1 min | 75% faster  | cached deps        |
| Test  | 15 min | 3 min | 80% faster  | 4 parallel shards  |
| Build | 6 min  | 1 min | 83% faster  | incremental builds |

Here is what we changed:

- Split the test job into 4 shards
- Cached dependencies between runs
- Moved linting off the critical path

The result: faster feedback, happier engineers, and shipping on a **Friday** without fear.

What is the one bottleneck slowing your team down?
