# Decisions

Decisions the plan did not specify, or that were made in review. Newest first within a phase.

## Phase 0 (2026-10-28)

- All §11 recommendations accepted by the owner:
  - Auth: ADR-0003, hand-rolled; Cognito as stretch S1.
  - Hosting: ECS Fargate for both `web` and `api`.
  - Database: MongoDB Atlas (replica set; PrivateLink from M10 in prod).
  - LocalStack: Hobby token; the project is non-commercial. If that changes, CI switches to the
    in-memory fakes and this entry is superseded.
  - Name: Ledgerly.
- ADR-0001, ADR-0002 and ADR-0003 moved from `proposed` to `accepted`.
- Repository is separate from `kaustubh007/DigiPayments` (Meridian Pay); nothing is shared
  between them.
