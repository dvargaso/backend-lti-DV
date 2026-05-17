import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

interface CandidateForPosition {
    candidateName: string;
    currentInterviewStep: string;
    averageScore: number | null;
}

export const getCandidatesForPosition = async (positionId: number): Promise<CandidateForPosition[]> => {
    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) {
        throw new NotFoundError('Position not found');
    }

    const applications = await prisma.application.findMany({
        where: { positionId },
        include: {
            candidate: { select: { firstName: true, lastName: true } },
            interviewStep: { select: { name: true } },
            interviews: {
                where: {
                    score: { not: null },
                    result: { not: null },
                },
            },
        },
    });

    return applications.map((app) => {
        const scores = app.interviews.map((i) => i.score as number);
        const averageScore =
            scores.length > 0
                ? scores.reduce((sum, s) => sum + s, 0) / scores.length
                : null;

        return {
            candidateName: `${app.candidate.firstName} ${app.candidate.lastName}`,
            currentInterviewStep: app.interviewStep.name,
            averageScore,
        };
    });
};
