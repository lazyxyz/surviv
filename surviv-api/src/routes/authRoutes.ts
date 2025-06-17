import { Router } from 'express';
import { requestNonce, verifySignature } from '../controllers/authController';

const router = Router();

router.get('/requestNonce', requestNonce);
router.post('/verifySignature', verifySignature);

export default router;