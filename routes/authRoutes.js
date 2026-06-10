import express from 'express';
import { login, logout, getMe, refresh, logoutAllDevices } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAllDevices);
router.get('/me', protect, getMe);

export default router;
