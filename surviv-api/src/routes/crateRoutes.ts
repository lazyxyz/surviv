import { Router } from 'express';
import { getCrates, getCratesByAddress} from '../controllers/crateController';

const router = Router();

router.get('/getCrates', getCrates);
router.get('/testGetCrates', getCratesByAddress);

export default router;