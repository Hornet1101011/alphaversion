import { Router } from 'express';
import { getActivityLogs } from '../controllers/activityLogController';

const router = Router();

// GET /activity-logs
router.get('/', getActivityLogs);

export default router;
