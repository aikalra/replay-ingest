# From free pilot to paid - the shape, not the numbers

This page exists so the paid conversation has a structure before it has prices.
Every number in it is an editable, labeled assumption for the buyer to replace -
the same rule as the scorecard. Nothing here asserts a price.

## What the free pilot measures (and why it prices the paid step)

Four weeks of a partner-hosted pilot produce, from the buyer's own data:

- records per site per week (the volume the paid tier must carry)
- data-quality distribution of the buyer's own exports (high / degraded /
  insufficient) - this, not a promise, shows what their telemetry supports
- longitudinal patterns actually found in their records (repeat claimants,
  repeat origins) - the value evidence, in their data not ours
- the review-time and cycle-time deltas against THEIR baselines, which they
  typed in themselves
- uptime of the ingest endpoint on their infrastructure over the pilot

The paid price is justified or refuted by these numbers. A pilot that found
nothing and changed nothing is a clean no for both sides.

## Pricing shapes (structure options, buyer picks)

1. Per site per month - simplest; scales with their footprint. Fits liability
   (stores) and property (residences).
2. Per vehicle per month - the fleet shape for accident.
3. Per record - aligns cost with usage exactly; needs a monthly cap so the
   buyer's finance team can sign it.

Each shape is one line in an order form once the pilot numbers exist:
`<shape> x <assumption: rate> x <measured: sites or vehicles or records> =
<assumption: monthly total>`.

## What the paid tier adds over the free pilot

- support and a named contact (the free pilot is self-serve)
- multi-site roll-out under one org (multi-tenant isolation is already in the
  service - org-scoped keys, org-wide records view, cross-tenant isolation)
- key rotation and revocation runbooks (already in the service)
- the audit chain exported for their counsel or reinsurer on request

## What we do NOT do in the paid conversation

- quote savings - the buyer's own scorecard arithmetic is the only savings
  math in the room
- take their telemetry onto our infrastructure - partner-hosted is the product,
  not a pilot concession
- price before the pilot numbers exist
