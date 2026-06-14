import express from 'express';
import { getUsers, createUser, updateUser, deleteUser, getAnalytics, getAuditLogs, getGeneralChannel } from '../controllers/adminController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply auth protection & admin authorization to all admin endpoints
router.use(protect);
router.use(authorize('admin'));

router.route('/users')
  .get(getUsers)
  .post(createUser);

router.route('/users/:id')
  .patch(updateUser)
  .delete(deleteUser);

router.get('/analytics', getAnalytics);
router.get('/audit-logs', getAuditLogs);
router.get('/general-channel', getGeneralChannel);

export default router;
