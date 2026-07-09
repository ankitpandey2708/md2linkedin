# Shipping MCP support

We just shipped **Model Context Protocol** support. Here's the *TL;DR* and a quick `benchmark` note, with docs at [our guide](https://example.com/guide).

## Why it matters

- One standard, many clients
- No per-integration glue
- Works with `tools/list` discovery

## Narrow table (fits)

| Aspect | Before | After |
|---|---|---|
| Setup | manual | auto |
| Cost | high | low |
| Clients | one | any |

## Wide table (wrap test)

| Component | Responsibility in the system | Owner team | Current status |
|---|---|---|---|
| Gateway | routes and authenticates every inbound request | Platform | shipped and stable |
| Indexer | builds the search index from the event stream | Data | in progress this quarter |

## Long code line (wrap test)

```js
const result = await fetch("https://api.example.com/v1/resource?verbose=true&limit=100&sort=desc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
```
