import { Request, Response } from 'express';
import { getCandidatesForPosition, NotFoundError } from '../../application/services/positionService';

export const getCandidatesForPositionController = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid position ID' });
    }
    try {
        const candidates = await getCandidatesForPosition(id);
        res.json(candidates);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
