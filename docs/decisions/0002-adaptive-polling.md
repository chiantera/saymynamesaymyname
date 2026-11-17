# 0002 — Adaptive guarded polling

Accepted 2026-11-17. Constant cloud reads were excessive for idle tabs and repeated
identity verification per operation. Use completion-driven read pollers, an idle
cadence, faster reads for observed active jobs and bounded failure backoff. Pause
while hidden, refresh once on return/Home navigation, and batch related reads under
one verified identity while retaining before/after account-generation checks.

Tradeoff: remote idle changes can take one idle interval to appear. Manual actions
and Home/visibility return refresh immediately. Polling is not a send scheduler;
server authorization and durable queues remain authoritative. No global cached
identity substitutes for authentication. [Contract/tests](../implementation/POLLING.md).
