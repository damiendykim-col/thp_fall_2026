# Documentation map

Reviewed October 15, 2026. Start with the repository [README](../README.md).

## Authoritative references

- [Current plan](design/README.md): priorities, completed work, gates and deferred ideas.
- [Deployment](deployment.md): fresh versus existing databases, credentials, OAuth and release checks.
- [Local development and E2E](e2e.md): isolated backend, test accounts and CI.
- [Challenge contract](design/01-caption-challenges.md) and [operational limits](design/01-stage-1-setup.md).

## Current feature behavior

- [Creation](challenge-creation.md), [draft editing](challenge-editing.md), and [arrival/return visits](arrival-and-return.md).
- [Image descriptions](image-descriptions.md), [GIFs](gif-challenges.md), and [moderation](moderation.md).
- [Taste proposal](design/02-taste-profiles.md) and [private evaluation tools](../scripts/experiments/taste/README.md).
- Deferred [Members graph](design/03-members-graph.md) and [temporal context](design/04-temporal-context.md).

## Historical and compatibility references

These explain earlier decisions; they are not additional setup or pending work:

- [Assignment 3](assignment-3-setup.md): original profile/Auth setup, superseded by canonical migrations.
- [Profile cutover](profile-schema-rollout.md): completed normalization and verification history.
- [October 10 maintenance](database-maintenance-2026-10-10.md): dated hosted schema/grants evidence and known drift.
- [Winner RPC](winners-gallery.md): retained database compatibility contract; the old winner-only UI is retired.
- [Performance investigation](performance.md): historical measurements, not current benchmarks.

Feature documents describe repository behavior. Dated hosted checks establish only
what was verified then; a local build or a migration file does not prove deployment.
Keep priorities in the current plan rather than creating competing feature checklists.
