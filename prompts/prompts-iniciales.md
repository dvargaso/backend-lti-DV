# Create spec for first endpoint

You are a senior backend engineer working in this repo:

I need you to create a concise backend implementation spec for this endpoint:

GET /positions/:id/candidates

Endpoint purpose:
Retrieve all candidates currently in process for a given position, meaning all applications for the given position ID.

Required candidate data:
- candidate full name from the Candidate table
- current_interview_step from the Application table
- candidate average score, based on scored completed interviews

Scope and constraints:
- Backend only; frontend is out of scope
- Follow the existing layered architecture
- Use a bottom-up approach: data layer → service/business logic → controller/route
- Include integration test coverage with the database mocked
- Include acceptance criteria that can be directly converted into tests
- Keep the spec concise and implementation-oriented
- Do not write code

Before writing the spec, ask me the key clarifying questions needed to avoid wrong assumptions.

Use this output format:

# Spec: GET /positions/:id/candidates

## Clarified Decisions
## Implementation Plan
## Acceptance Criteria
## Integration Test Plan
## Out of Scope

Save the spec as: list_candidates_with_score_SPEC.md