export interface Notification {
  id: string;
  _id?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type?: string;
  data?: any; // Optional data property added
}
