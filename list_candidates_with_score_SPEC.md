# Spec: GET /positions/:id/candidates

## Clarified Decisions

| Question | Decision |
|---|---|
| avg_score when no completed interviews | Return `null` |
| "Completed" interview definition | `score IS NOT NULL AND result IS NOT NULL` (Interview has no explicit status field; `result` is the closest proxy) |
| Position not found | 404 with JSON error body |
| Active vs. all applications | **Schema gap:** `Application` has no `status` field. All applications for the position will be returned. Active filtering is deferred until the schema is extended with an application status. |

---

## Implementation Plan

Bottom-up: data layer → service → controller → route → registration.

### 1. Domain model — `backend/src/domain/models/Application.ts`

Add a static method:

```
static async findByPositionId(positionId: number): Promise<RawApplicationRow[]>
```

Uses the Prisma client (same pattern as existing `findOne`). Runs one query:

```
prisma.application.findMany({
  where: { positionId },
  include: {
    candidate: { select: { firstName, lastName } },
    interviewStep: { select: { name } },
    interviews: {
      where: { score: { not: null }, result: { not: null } }
    }
  }
})
```

Returns the raw Prisma result array; score averaging is done in the service.

### 2. Service — `backend/src/application/services/positionService.ts` (new file)

```
async function getCandidatesForPosition(positionId: number): Promise<CandidateRow[]>
```

- Verifies position exists via `prisma.position.findUnique({ where: { id: positionId } })`; throws a typed `NotFoundError` if missing.
- Calls `Application.findByPositionId(positionId)`.
- Maps each row to:
  ```
  {
    candidateName: `${firstName} ${lastName}`,
    currentInterviewStep: interviewStep.name,
    averageScore: interviews.length > 0
      ? interviews.reduce((s, i) => s + i.score, 0) / interviews.length
      : null
  }
  ```
- Does **not** receive `req` or `res`; no HTTP concerns here.

### 3. Controller — `backend/src/presentation/controllers/positionController.ts` (new file)

Pattern mirrors the existing `getCandidateById` controller:

```
export async function getCandidatesForPosition(req: Request, res: Response)
```

- Parses `req.params.id` to integer; returns 400 if `NaN`.
- Calls service function.
- Catches `NotFoundError` → 404.
- Catches unexpected errors → 500.

### 4. Routes — `backend/src/routes/positionRoutes.ts` (new file)

```
GET /:id/candidates → getCandidatesForPosition controller
```

### 5. Registration — `backend/src/index.ts`

Add one line alongside the existing `/candidates` route:

```typescript
app.use('/positions', positionRouter);
```

### Response shape (200)

```json
[
  {
    "candidateName": "Jane Smith",
    "currentInterviewStep": "Technical Interview",
    "averageScore": 8.5
  },
  {
    "candidateName": "John Doe",
    "currentInterviewStep": "HR Screen",
    "averageScore": null
  }
]
```

---

## Acceptance Criteria

1. `GET /positions/1/candidates` returns 200 with an array of candidate objects for position 1.
2. Each object contains `candidateName` (string), `currentInterviewStep` (string), `averageScore` (number | null).
3. `averageScore` is the mean of `score` from interviews where `score IS NOT NULL AND result IS NOT NULL`; rounded to at most 2 decimal places is acceptable but not required.
4. `averageScore` is `null` when a candidate has no qualifying interviews.
5. `GET /positions/9999/candidates` returns 404 `{ "error": "Position not found" }`.
6. `GET /positions/abc/candidates` returns 400 `{ "error": "Invalid position ID" }`.
7. A position with no applications returns 200 with an empty array `[]`.

---

## Integration Test Plan

**File:** `backend/src/tests/positionCandidates.test.ts`

**Setup:** Mock the Prisma client using `jest.mock` (consistent with the existing codebase's use of `ts-jest`; no real DB required). Provide mock return values via `prismaMock.position.findUnique.mockResolvedValue(...)` and `prismaMock.application.findMany.mockResolvedValue(...)`.

**Test cases:**

| # | Scenario | Mock setup | Expected |
|---|---|---|---|
| 1 | Valid position, multiple candidates, some with scores | Position exists; 2 applications with interviews (one scored, one not) | 200, correct avg_score values |
| 2 | Candidate with multiple scored interviews | Position exists; 1 application with 3 scored interviews | 200, avg_score = mean of all three |
| 3 | Candidate with zero scored interviews | Position exists; 1 application, interviews have null score or null result | 200, avg_score = null |
| 4 | Position with no applications | Position exists; applications = [] | 200, body = [] |
| 5 | Position ID does not exist | `findUnique` returns null | 404, `{ error: "Position not found" }` |
| 6 | Non-numeric position ID | No mock needed | 400, `{ error: "Invalid position ID" }` |

---

## Out of Scope

- Frontend changes
- Pagination or sorting of results
- Application status filtering (Application schema has no status field; requires a future migration)
- Authentication / authorization
- Filtering by position status (e.g., only "Open" positions)
