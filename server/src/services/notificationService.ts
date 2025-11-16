import { Notification } from '../models/Notification';
import { FilterQuery } from 'mongoose';

interface GetNotificationsOptions {
  userId: string;
  page?: number;
  limit?: number;
  search?: string;
  type?: 'documents' | 'inquiries' | 'system' | 'all';
  sort?: string;
}

export async function getNotifications({ userId, page = 1, limit = 10, search = '', type = 'all', sort = '-createdAt' }: GetNotificationsOptions) {
  // Accept both `userId` and legacy `user` field names so older seeded docs are returned
  const filter: FilterQuery<any> = { $or: [{ userId }, { user: userId }] };
  if (type && type !== 'all') filter.type = type;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } },
    ];
  }
  const total = await Notification.countDocuments(filter);
  const data = await Notification.find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  return {
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

export async function markAsRead(id: string) {
  return Notification.findByIdAndUpdate(id, { read: true });
}

export async function markManyAsRead(ids: string[]) {
  return Notification.updateMany({ _id: { $in: ids } }, { read: true });
}

export async function deleteNotification(id: string) {
  return Notification.findByIdAndDelete(id);
}

export async function deleteManyNotifications(ids: string[]) {
  return Notification.deleteMany({ _id: { $in: ids } });
}
