# Investigating navigation latency

## Baseline: October 2, 2026

The supplied Vercel export has 32 log records representing 16 requests, with a middleware and a function record for each. One `/members.rsc` function took 926 ms. Initial home-page functions took 631 ms and 1,451 ms on two different hostnames. Other function records took 9–50 ms; many were RSC requests clustered at the same second and may be prefetches rather than completed navigations. Middleware took 7–571 ms. Do not treat these as 16 measured user clicks or simply add all durations to estimate browser latency.

Middleware ran in `sfo1`, functions in `iad1`. Confirm the Supabase project's region before considering a deployment-region change. These logs do not establish whether cold starts, network travel, authentication, storage, or SQL execution caused the delays.

The supplied Supabase CSV is an aggregate statement report with 20 entries. It contains extension/function/table metadata inspection, timezone lookup, backups, and infrastructure queries. No entry references the app's images, profiles, avatar history, or member-list RPC. For example, the 421.46 ms mean and 43.22% time share belong to extension discovery. This is not evidence that the app's own queries are slow, nor proof that they are fast. The report has no request-level timestamps to correlate with the Vercel visit.

The Storage screenshot provides more direct evidence: a signed-avatar URL creation POST took 272 ms, avatar GETs took 396 and 622 ms, and public GIF GETs took 194–246 ms. The shown 304 cache revalidations took 20–24 ms. Each shown row has a count of one, so these are individual samples, not stable latency estimates. The overall 202.18 ms figure combines different operations. URL creation blocks the server's member-data rendering; image retrieval happens afterward in the browser. Neither value is pure SQL execution time, and the screenshot does not establish a full browser waterfall or exact correlation with the 926 ms Vercel request.

## Collecting useful measurements

1. Enable Speed Insights in the existing Vercel project and deploy this code. The root layout includes its Next.js component. It provides browser Web Vitals; it is not a breakdown of each tab's server work or a complete click-to-content timer. See [Vercel metrics](https://vercel.com/docs/speed-insights/metrics).
2. Temporarily set the server environment variable `PERF_LOGGING=true` in the Vercel environment under test, then redeploy. Filter runtime logs for `app-performance`. Each entry contains only a fixed operation name and `durationMs`; results, names, emails, tokens, photo paths, and signed URLs are not logged by this instrumentation.
3. On the same production hostname, sign in and navigate Images → Members → Profile → Images. Repeat several times, distinguishing the first visit from warm visits. In browser DevTools, preserve the Network log and examine the relevant document/RSC request's waiting time and total duration. Avoid using local development compilation as a production baseline.
4. Compare timing entries within the same Vercel request. `proxy.auth`, `page.auth`, and `header.auth` expose separate verification calls. `profile.completion`, `members.list`, and `images.list` measure data requests. `members.avatar`, `profile.avatar`, and `profile.history-avatar` measure signed URL creation. `profile.read` and `profile.history` separate the profile queries. These are end-to-end SDK call times, including network/API work and response parsing, not pure PostgreSQL execution time. Parallel operations overlap; do not sum them as wall time.
5. If data calls dominate, export statement statistics for actual application reads/RPCs over the relevant interval (including calls, mean/max execution time, and role). A slow SDK call paired with a fast SQL statement points toward service/network overhead rather than SQL execution alone.
6. Remove or set `PERF_LOGGING=false` and redeploy after the investigation to stop diagnostic log volume.

## Candidates to test after measuring

- Deduplicate page/header user verification within one server render using React's request-scoped cache. Keep authorization enforced on every request.
- Fetch independent profile/history queries concurrently and batch avatar URL signing. Members currently signs photos concurrently, but still sends a separate request per photo.
- Check placement of Vercel functions relative to Supabase.
- Add route-specific loading feedback for Members/Profile (the shared loading fallback currently says “Loading images…”). This improves feedback, not backend execution speed.

No SQL, RLS, session validation, region, or caching behavior was changed for this baseline instrumentation. A before/after speed improvement has not yet been measured.
