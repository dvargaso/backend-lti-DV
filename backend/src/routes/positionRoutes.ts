import { Router } from 'express';
import { getCandidatesForPositionController } from '../presentation/controllers/positionController';

const router = Router();

router.get('/:id/candidates', getCandidatesForPositionController);

export default router;
