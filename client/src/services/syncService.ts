import { localDB } from './localDatabase';
import axiosInstance from './api';

class SyncService {
  private static instance: SyncService;
  private isOnline: boolean = navigator.onLine;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.setupEventListeners();
    this.startSyncInterval();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = async (): Promise<void> => {
    this.isOnline = true;
    console.log('Connection restored. Starting sync...');
    await this.syncWithServer();
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    console.log('Connection lost. Operating in offline mode...');
  };

  private startSyncInterval(): void {
    if (this.syncInterval) return;
    
    // Attempt to sync every 5 minutes when online
    this.syncInterval = setInterval(async () => {
      if (this.isOnline) {
        await this.syncWithServer();
      }
    }, 5 * 60 * 1000);
  }

  private async syncWithServer(): Promise<void> {
    try {
      const pendingChanges = await localDB.getAllFromSyncQueue();
      if (pendingChanges.length === 0) return;
      console.log(`Syncing ${pendingChanges.length} pending changes...`);
      for (const change of pendingChanges) {
        try {
          await this.processSyncItem(change);
        } catch (error) {
          if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
            console.error(`Failed to sync item:`, change, error);
            if ((error as any).message === 'Network Error') {
              this.isOnline = false;
              break;
            }
          } else {
            console.error(`Failed to sync item:`, change, error);
          }
        }
      }
      // Clear successfully synced items
      await localDB.clearSyncQueue();
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
        console.error('Sync failed:', (error as any).message);
      } else {
        console.error('Sync failed:', error);
      }
    }
  }

  private async processSyncItem(item: any): Promise<void> {
    const { operation, collection, data } = item;
    
    switch (operation) {
      case 'create':
        await axiosInstance.post(`/api/${collection}`, data);
        break;
      
      case 'update':
        await axiosInstance.put(`/api/${collection}/${data._id}`, data);
        break;
      
      case 'delete':
        await axiosInstance.delete(`/api/${collection}/${data._id}`);
        break;
    }
  }

  public async performOperation(
    operation: 'create' | 'update' | 'delete',
    collection: string,
    data: any
  ): Promise<void> {
    // Save to local database first
    switch (operation) {
      case 'create':
      case 'update':
        await localDB.saveUser(data);
        break;
      case 'delete':
        await localDB.deleteUser(data._id);
        break;
    }

    // Add to sync queue
    await localDB.addToSyncQueue(operation, collection, data);

    // If online, try to sync immediately
    if (this.isOnline) {
      await this.syncWithServer();
    }
  }

  public cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

export const syncService = SyncService.getInstance();
