import { Router } from 'express';
import { getCrates } from '../controllers/crateController';

const router = Router();

router.get('/getCrates', getCrates);

export default router;