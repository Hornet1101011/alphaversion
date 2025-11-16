import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface BarangayDB extends DBSchema {
  users: {
    key: string;
    value: any;
    indexes: { 'by-email': string };
  };
  documents: {
    key: string;
    value: any;
    indexes: { 'by-user': string };
  };
  syncQueue: {
    key: string;
    value: {
      operation: 'create' | 'update' | 'delete';
      collection: string;
      data: any;
      timestamp: number;
    };
  };
}

class LocalDatabase {
  private db: IDBPDatabase<BarangayDB> | null = null;
  private static instance: LocalDatabase;

  private constructor() {}

  static getInstance(): LocalDatabase {
    if (!LocalDatabase.instance) {
      LocalDatabase.instance = new LocalDatabase();
    }
    return LocalDatabase.instance;
  }

  async initialize(): Promise<void> {
    this.db = await openDB<BarangayDB>('barangay-system', 1, {
      upgrade(db) {
        // Users store
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: '_id' });
          userStore.createIndex('by-email', 'email');
        }

        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: '_id' });
          docStore.createIndex('by-user', 'userId');
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { 
            keyPath: '_id',
            autoIncrement: true 
          });
        }
      },
    });
  }

  async addToSyncQueue(operation: 'create' | 'update' | 'delete', collection: string, data: any): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.add('syncQueue', {
      operation,
      collection,
      data,
      timestamp: Date.now()
    });
  }

  async getAllFromSyncQueue(): Promise<any[]> {
    if (!this.db) await this.initialize();
    return this.db!.getAll('syncQueue');
  }

  async clearSyncQueue(): Promise<void> {
    if (!this.db) await this.initialize();
    const tx = this.db!.transaction('syncQueue', 'readwrite');
    await tx.objectStore('syncQueue').clear();
  }

  // Users
  async saveUser(user: any): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.put('users', user);
  }

  async getUser(id: string): Promise<any | undefined> {
    if (!this.db) await this.initialize();
    return this.db!.get('users', id);
  }

  async getAllUsers(): Promise<any[]> {
    if (!this.db) await this.initialize();
    return this.db!.getAll('users');
  }

  async deleteUser(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('users', id);
  }

  // Documents
  async saveDocument(document: any): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.put('documents', document);
  }

  async getDocument(id: string): Promise<any | undefined> {
    if (!this.db) await this.initialize();
    return this.db!.get('documents', id);
  }

  async getAllDocuments(): Promise<any[]> {
    if (!this.db) await this.initialize();
    return this.db!.getAll('documents');
  }

  async deleteDocument(id: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.delete('documents', id);
  }

  // Settings
  async saveSettings(settings: any): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.put('users', { _id: 'settings', ...settings });
  }

  async getSettings(): Promise<any | undefined> {
    if (!this.db) await this.initialize();
    return this.db!.get('users', 'settings');
  }
}

export const localDB = LocalDatabase.getInstance();
