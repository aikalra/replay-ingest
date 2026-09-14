# Paid rollout order form - measured units, editable terms

This is a fill-in skeleton, not an offer and not an approved price. Use it only
after [PILOT-CLOSEOUT.md](PILOT-CLOSEOUT.md) records a proceed decision. Every
`<...>` field requires buyer and seller review before signature; nothing in this
page authorizes a rollout, charge, or commitment.

## Parties and scope

Seller: `<legal name and address>`  
Buyer: `<legal name and address>`  
Buyer owner: `<name and title>`  
Pilot org: `<org id>`  
Engine: `<liability | property | accident>`  
Initial rollout boundary: `<named sites | named vehicles | record scope>`

Source of unit count: `<dated PILOT-CLOSEOUT.md / org scorecard output>`.  
Measured pilot units: `<count>` as of `<date>`.

## Pick one pricing shape

Select one shape and strike the other two. Rates and totals are editable commercial
terms, not product claims.

### A. Per site per month

`<measured or approved site count> x <currency and rate per site/month> =
<assumed monthly total>`

### B. Per vehicle per month

`<measured or approved vehicle count> x <currency and rate per vehicle/month> =
<assumed monthly total>`

### C. Per accepted record

`<measured records/month> x <currency and rate per accepted record> =
<assumed monthly usage total>, capped at <currency and monthly cap>`

Selected shape: `<A | B | C>`  
Billing currency: `<currency>`  
Billing frequency: `<monthly | other>`  
Taxes: `<included | added as required | buyer-exempt evidence>`  
First bill date: `<date>`

No charge is approved by the pilot scorecard or by this arithmetic. The parties
approve the selected shape, unit definition, rate, cap, taxes, and bill date in the
signed version.

## What is included

- partner-hosted replay-ingest for the selected engine and rollout boundary
- org-scoped records and cross-tenant isolation
- key rotation and revocation runbooks
- buyer-run audit-chain verification and ledger export
- named support contact: `<name / channel / hours / response target>`

Not included unless added in signed terms: hosting by seller, access to buyer
telemetry, custom integrations, new engine behavior, or production work outside the
approved boundary.

## Buyer responsibilities

- operate the service on buyer-controlled infrastructure
- keep the data volume and keys under buyer backup, retention, and access policies
- terminate TLS at the buyer's proxy and restrict network/CORS origins
- provide exports that match the versioned engine contract
- name an incident and restore owner

Production rollout is subject to the accepted gates and evidence in
[PRODUCTION-READINESS.md](PRODUCTION-READINESS.md). An unchecked required gate is a
hold, unless the signed version names the limited boundary, owner, due date, and
accepted risk.

## Term and change boundary

Start date: `<date>`  
Initial term: `<term>`  
Renewal: `<none | renewal mechanics>`  
Cancellation notice: `<days and delivery method>`  
Data at exit: `<buyer keeps volume | deletion / return procedure>`  
Unit-count review: `<monthly | quarterly | other>`

A site, vehicle, org, engine, usage cap, or integration outside the boundary above
needs a written change. The new unit count and commercial effect are shown before it
starts.

## Acceptance and signature

Attach or reference:

- `<pilot closeout date and decision>`
- `<org scorecard evidence date>`
- `<production readiness decision and approved boundary>`
- `<security / legal exhibits, if any>`

Seller signature: `<name / title / date>`  
Buyer signature: `<name / title / date>`
