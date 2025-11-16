
import io from 'socket.io-client';
type SocketType = ReturnType<typeof io>;

let socket: SocketType | null = null;

export function initNotificationSocket(token?: string) {
  if (socket) return socket;
  // Use your backend URL here
  socket = io('/', {
    path: '/socket.io',
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    autoConnect: true,
  });
  return socket;
}

export function onNotificationEvent(event: string, handler: (...args: any[]) => void) {
  if (!socket) return;
  socket.on(event, handler);
}

export function offNotificationEvent(event: string, handler: (...args: any[]) => void) {
  if (!socket) return;
  socket.off(event, handler);
}

export function getSocket() {
  return socket;
}
