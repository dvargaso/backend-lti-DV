jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        application: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        interviewStep: {
            findUnique: jest.fn(),
        },
    })),
}));

import { PrismaClient } from '@prisma/client';
import { updateCandidateStage, NotFoundError } from '../application/services/candidateService';

let mockAppFindUnique: jest.Mock;
let mockStepFindUnique: jest.Mock;
let mockAppUpdate: jest.Mock;

beforeAll(() => {
    // candidateService's own `const prisma = new PrismaClient()` runs after all domain model
    // imports are resolved, so it is always the last instance in mock.results.
    const results = (PrismaClient as jest.Mock).mock.results;
    const prismaInstance = results[results.length - 1].value;
    mockAppFindUnique = prismaInstance.application.findUnique;
    mockStepFindUnique = prismaInstance.interviewStep.findUnique;
    mockAppUpdate = prismaInstance.application.update;
});

beforeEach(() => {
    jest.clearAllMocks();
});

const makeApplication = (overrides: any = {}) => ({
    id: 5,
    positionId: 2,
    candidateId: 1,
    applicationDate: new Date(),
    currentInterviewStep: 1,
    notes: null,
    position: { interviewFlowId: 10 },
    ...overrides,
});

const makeInterviewStep = (overrides: any = {}) => ({
    id: 3,
    interviewFlowId: 10,
    interviewTypeId: 1,
    name: 'Technical Interview',
    orderIndex: 2,
    ...overrides,
});

const makeUpdatedApplication = (overrides: any = {}) => ({
    id: 5,
    positionId: 2,
    candidateId: 1,
    applicationDate: new Date(),
    currentInterviewStep: 3,
    notes: null,
    interviewStep: { id: 3, name: 'Technical Interview', orderIndex: 2 },
    ...overrides,
});

describe('updateCandidateStage', () => {
    it('updates the application and returns it with the resolved interviewStep', async () => {
        const updatedApplication = makeUpdatedApplication();
        mockAppFindUnique.mockResolvedValueOnce(makeApplication());
        mockStepFindUnique.mockResolvedValueOnce(makeInterviewStep());
        mockAppUpdate.mockResolvedValueOnce(updatedApplication);

        const result = await updateCandidateStage(1, 5, 3);

        expect(result).toEqual(updatedApplication);
    });

    it('throws NotFoundError when application does not exist', async () => {
        mockAppFindUnique.mockResolvedValueOnce(null);

        await expect(updateCandidateStage(1, 999, 3)).rejects.toThrow(NotFoundError);
        await expect(updateCandidateStage(1, 999, 3)).rejects.toThrow('Application not found');
    });

    it('throws NotFoundError when application belongs to a different candidate', async () => {
        mockAppFindUnique.mockResolvedValueOnce(makeApplication({ candidateId: 99 }));

        await expect(updateCandidateStage(1, 5, 3)).rejects.toThrow(NotFoundError);
        await expect(updateCandidateStage(1, 5, 3)).rejects.toThrow('Application not found');
    });

    it('throws Error when interviewStep does not exist', async () => {
        mockAppFindUnique.mockResolvedValueOnce(makeApplication());
        mockStepFindUnique.mockResolvedValueOnce(null);

        await expect(updateCandidateStage(1, 5, 999)).rejects.toThrow('Invalid interview step');
    });

    it("throws Error when interviewStep does not belong to the position's interview flow", async () => {
        mockAppFindUnique.mockResolvedValueOnce(makeApplication({ position: { interviewFlowId: 10 } }));
        mockStepFindUnique.mockResolvedValueOnce(makeInterviewStep({ interviewFlowId: 99 }));

        await expect(updateCandidateStage(1, 5, 3)).rejects.toThrow(
            "Interview step does not belong to this position's interview flow"
        );
    });

    it('propagates unexpected errors from the database', async () => {
        mockAppFindUnique.mockResolvedValueOnce(makeApplication());
        mockStepFindUnique.mockResolvedValueOnce(makeInterviewStep());
        mockAppUpdate.mockRejectedValueOnce(new Error('DB connection lost'));

        await expect(updateCandidateStage(1, 5, 3)).rejects.toThrow('DB connection lost');
    });
});
