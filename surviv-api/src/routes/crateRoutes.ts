import { Router } from 'express';
import { getCrates, removeCrates} from '../controllers/crateController';

const router = Router();

router.get('/getCrates', getCrates);
router.post('/removeCrates', removeCrates);

export default router;