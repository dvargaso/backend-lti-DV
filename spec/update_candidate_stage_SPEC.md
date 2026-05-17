# Spec: PUT /candidates/:id/stage

## Clarified Decisions
- **Application scope**: Caller supplies `applicationId` in the body. The `:id` param is an ownership check (confirms the application belongs to that candidate), not a lookup key by itself.
- **Step validation**: The new `currentInterviewStep` must belong to the InterviewFlow associated with the application's Position. Cross-flow assignments are rejected.
- **Success response**: Return the updated Application object including the resolved `interviewStep` relation.

---

## Endpoint Contract

**Request**
```
PUT /candidates/:id/stage
Content-Type: application/json
```
```json
{
  "applicationId": 5,
  "currentInterviewStep": 3
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `:id` (param) | integer | yes | Candidate ID |
| `applicationId` | integer | yes | Identifies which Application to update |
| `currentInterviewStep` | integer | yes | Target InterviewStep.id |

**Success Response — 200 OK**
```json
{
  "id": 5,
  "positionId": 2,
  "candidateId": 1,
  "applicationDate": "2024-01-15T00:00:00.000Z",
  "currentInterviewStep": 3,
  "notes": null,
  "interviewStep": {
    "id": 3,
    "name": "Technical Interview",
    "orderIndex": 2
  }
}
```

---

## Behavior

Service function signature: `updateCandidateStage(candidateId: number, applicationId: number, interviewStepId: number)`

Execution steps:
1. Look up Application by `applicationId` (include `position.interviewFlowId` and `interviewStep`).
2. If not found → throw `NotFoundError('Application not found')`.
3. If `application.candidateId !== candidateId` → throw `NotFoundError('Application not found')` (do not leak existence).
4. Look up the target InterviewStep by `interviewStepId`.
5. If not found → throw `Error('Invalid interview step')`.
6. If `interviewStep.interviewFlowId !== application.position.interviewFlowId` → throw `Error("Interview step does not belong to this position's interview flow")`.
7. Update `Application.currentInterviewStep = interviewStepId` via Prisma, returning with `interviewStep` included.
8. Return the updated Application.

---

## Validation and Error Handling

| Condition | HTTP Status | Response body |
|---|---|---|
| `:id` is not a valid integer | 400 | `{ "error": "Invalid candidate ID" }` |
| `applicationId` missing or not integer | 400 | `{ "error": "Invalid application ID" }` |
| `currentInterviewStep` missing or not integer | 400 | `{ "error": "Invalid interview step ID" }` |
| Application not found | 404 | `{ "error": "Application not found" }` |
| Application belongs to a different candidate | 404 | `{ "error": "Application not found" }` |
| InterviewStep not found | 400 | `{ "error": "Invalid interview step" }` |
| InterviewStep not in position's InterviewFlow | 400 | `{ "error": "Interview step does not belong to this position's interview flow" }` |
| Unexpected DB error | 500 | `{ "error": "An unexpected error occurred" }` |

Input validation (400 cases) is handled in the controller before calling the service. Business rule errors (404 and flow mismatch) are thrown from the service and caught in the route handler/controller.

---

## Acceptance Criteria

1. A valid request with a matching candidateId, applicationId, and a step that belongs to the position's flow → 200 with updated Application including `interviewStep`.
2. Non-integer `:id` → 400.
3. Missing `applicationId` → 400.
4. Missing `currentInterviewStep` → 400.
5. `applicationId` that does not exist in the DB → 404.
6. `applicationId` that exists but belongs to a different candidate → 404 (same message as #5 — no leak).
7. `currentInterviewStep` that does not exist in the DB → 400.
8. `currentInterviewStep` that exists but belongs to a different InterviewFlow than the position's → 400.
9. Prisma throws an unexpected error → 500.

---

## Integration Test Plan

**File**: `backend/src/tests/updateCandidateStage.test.ts`

**Mock strategy** (mirrors `positionCandidates.test.ts`):
- `jest.mock('@prisma/client', ...)` at the top of the file
- Capture mock instance in `beforeAll`
- `jest.clearAllMocks()` in `beforeEach`
- Factory functions: `makeApplication(overrides?)`, `makeInterviewStep(overrides?)`

**Mocked Prisma operations:**
- `prisma.application.findUnique` — returns application with `position.interviewFlow` and `interviewStep`
- `prisma.interviewStep.findUnique` — returns target step
- `prisma.application.update` — returns updated application

**Test cases:**

| # | Scenario | Mock setup | Expected |
|---|---|---|---|
| 1 | Happy path | findUnique returns valid app; step found; step.interviewFlowId matches | 200 + updated application |
| 2 | Invalid `:id` (NaN) | — | 400 `Invalid candidate ID` |
| 3 | Missing `applicationId` | — | 400 `Invalid application ID` |
| 4 | Missing `currentInterviewStep` | — | 400 `Invalid interview step ID` |
| 5 | Application not found | findUnique returns null | 404 `Application not found` |
| 6 | Wrong candidate ownership | findUnique returns app with different candidateId | 404 `Application not found` |
| 7 | InterviewStep not found | step findUnique returns null | 400 `Invalid interview step` |
| 8 | Step in wrong flow | step.interviewFlowId ≠ position.interviewFlowId | 400 `Interview step does not belong to this position's interview flow` |
| 9 | DB error on update | update throws Error | 500 |

---

## Schema/Model Assumptions Confirmed
- `Application.currentInterviewStep` is the FK to `InterviewStep.id` (confirmed in schema).
- `Application` → `Position` → `interviewFlowId` gives the expected flow for a candidate's application.
- `InterviewStep.interviewFlowId` is the FK back to `InterviewFlow` (confirmed).
- No enum constraint on steps — any `InterviewStep` in the correct flow is valid.

---

## Files to Create/Modify

| File | Change |
|---|---|
| `backend/src/routes/candidateRoutes.ts` | Add `router.put('/:id/stage', updateCandidateStageController)` |
| `backend/src/presentation/controllers/candidateController.ts` | Add `updateCandidateStageController` |
| `backend/src/application/services/candidateService.ts` | Add `updateCandidateStage` service function |
| `backend/src/tests/updateCandidateStage.test.ts` | New test file (9 test cases above) |

---

## Out of Scope
- Authentication / authorization (no auth middleware in current codebase).
- Enforcing step order (no requirement to advance only forward).
- Updating `Interview` records — this endpoint only moves the pointer, not creates interview records.
- Candidate existence check — ownership is confirmed implicitly via `Application.candidateId`.
