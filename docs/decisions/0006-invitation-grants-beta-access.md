# 0006 — Accepting an invitation admits the recipient

Accepted 2026-11-18 by the owner. Supersedes the earlier rule that beta admission
is always separate from relationship invitations.

## Context

An invited person who had signed up and verified their email still stopped at the
"not admitted" screen, because every relationship function required prior beta
admission. They could never see or accept the invitation, so relationships stayed
single-member and sharing had no recipients.

## Decision

Accepting a relationship invitation also admits that account to the invite-only
beta. Only the invitation preview and accept/decline are allowed before admission;
every other relationship, sharing, check-in and settings function still requires it.
All existing invitation checks stay: unanimous approval at the current membership
version, issued status, seven-day expiry, single use, digest-only token lookup, the
caller's verified email equal to the invited address, and no membership or pair
block conflict. Declining admits nobody. A forwarded link admits nobody, because the
recipient email must match.

The client shows an unadmitted account holding an invitation link only the
invitation review; after accepting it re-checks access and opens Relationships.

## Consequences

Any current member who gets every other member's approval can now bring a new
person into the beta. That matches the invite-only intent: access still flows only
through a deliberate, unanimous, recipient-bound invitation. Operator admission
remains available for people who are not invited to a relationship.

Evidence: [membership](../implementation/MEMBERSHIP.md) tests cover preview and
acceptance by an unadmitted recipient, decline, an unverified recipient and a
forwarded link; the SQL-backed browser suite joins as an unadmitted account.
