import { Log } from '../models/Log';

/**
 * Save a staff activity log to MongoDB.
 * @param type - The type of activity (e.g., 'CREATE', 'UPDATE', 'DELETE', etc.)
 * @param message - A short description of the activity
 * @param details - Additional details about the activity
 * @param actor - The staff member who performed the activity
 * @param target - The target of the activity (optional)
 */
export async function saveStaffActivityLog({
  type,
  message,
  details,
  actor,
  target
}: {
  type: string;
  message: string;
  details: string;
  actor: string;
  target?: string;
}) {
  const log = new Log({
    type,
    message,
    details,
    actor,
    target
  });
  await log.save();
}
