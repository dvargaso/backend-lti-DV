jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        position: { findUnique: jest.fn() },
        application: { findMany: jest.fn() },
    })),
}));

import { PrismaClient } from '@prisma/client';
import { getCandidatesForPosition, NotFoundError } from '../application/services/positionService';

let mockFindUnique: jest.Mock;
let mockFindMany: jest.Mock;

beforeAll(() => {
    // Service imports PrismaClient and calls new PrismaClient() at module level.
    // Capture the instance here before clearAllMocks wipes mock.results.
    const prismaInstance = (PrismaClient as jest.Mock).mock.results[0].value;
    mockFindUnique = prismaInstance.position.findUnique;
    mockFindMany = prismaInstance.application.findMany;
});

beforeEach(() => {
    jest.clearAllMocks();
});

const makeApplication = (overrides: any = {}) => ({
    id: 1,
    positionId: 1,
    candidateId: 1,
    applicationDate: new Date(),
    currentInterviewStep: 1,
    notes: null,
    candidate: { firstName: 'Jane', lastName: 'Smith' },
    interviewStep: { name: 'Technical Interview' },
    interviews: [],
    ...overrides,
});

describe('getCandidatesForPosition', () => {
    it('returns candidates with correct average scores for a valid position', async () => {
        mockFindUnique.mockResolvedValueOnce({ id: 1, title: 'Engineer' });
        mockFindMany.mockResolvedValueOnce([
            makeApplication({
                candidate: { firstName: 'Jane', lastName: 'Smith' },
                interviewStep: { name: 'Technical Interview' },
                interviews: [{ score: 8, result: 'passed' }],
            }),
            makeApplication({
                id: 2,
                candidate: { firstName: 'John', lastName: 'Doe' },
                interviewStep: { name: 'HR Screen' },
                interviews: [],
            }),
        ]);

        const result = await getCandidatesForPosition(1);

        expect(result).toEqual([
            { candidateName: 'Jane Smith', currentInterviewStep: 'Technical Interview', averageScore: 8 },
            { candidateName: 'John Doe', currentInterviewStep: 'HR Screen', averageScore: null },
        ]);
    });

    it('computes average across multiple scored interviews', async () => {
        mockFindUnique.mockResolvedValueOnce({ id: 1, title: 'Engineer' });
        mockFindMany.mockResolvedValueOnce([
            makeApplication({
                interviews: [
                    { score: 6, result: 'ok' },
                    { score: 9, result: 'ok' },
                    { score: 9, result: 'ok' },
                ],
            }),
        ]);

        const result = await getCandidatesForPosition(1);

        expect(result[0].averageScore).toBe(8);
    });

    it('returns null averageScore when candidate has no completed interviews', async () => {
        mockFindUnique.mockResolvedValueOnce({ id: 1, title: 'Engineer' });
        mockFindMany.mockResolvedValueOnce([
            makeApplication({ interviews: [] }),
        ]);

        const result = await getCandidatesForPosition(1);

        expect(result[0].averageScore).toBeNull();
    });

    it('returns empty array when position has no applications', async () => {
        mockFindUnique.mockResolvedValueOnce({ id: 1, title: 'Engineer' });
        mockFindMany.mockResolvedValueOnce([]);

        const result = await getCandidatesForPosition(1);

        expect(result).toEqual([]);
    });

    it('throws NotFoundError when position does not exist', async () => {
        mockFindUnique.mockResolvedValueOnce(null);

        await expect(getCandidatesForPosition(9999)).rejects.toThrow(NotFoundError);
        await expect(getCandidatesForPosition(9999)).rejects.toThrow('Position not found');
    });
});
