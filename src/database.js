import { MongoClient, ObjectId } from 'mongodb';
import config from './config.js';

class DatabaseManager {
  static instance = null;
  client = null;
  masterDb = null;

  static getInstance() {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async connect() {
    try {
      if (this.client && this.client.topology?.isConnected()) {
        console.log('MongoDB already connected');
        return;
      }

      this.client = new MongoClient(config.mongoUrl);
      await this.client.connect();
      this.masterDb = this.client.db(config.masterDbName);

      // Verify connection
      await this.masterDb.admin().ping();
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.masterDb = null;
      console.log('Disconnected from MongoDB');
    }
  }

  getDb() {
    return this.masterDb;
  }

  getClient() {
    return this.client;
  }

  async getOrgDb(orgName) {
    const dbName = `org_${orgName.toLowerCase().replace(/\s+/g, '_')}`;
    return this.client.db(dbName);
  }

  async createOrgDatabase(orgName) {
    const dbName = `org_${orgName.toLowerCase().replace(/\s+/g, '_')}`;
    const orgDb = this.client.db(dbName);

    // Create a users collection with index
    const usersCollection = orgDb.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });

    return { dbName, orgDb };
  }

  async deleteOrgDatabase(orgName) {
    const dbName = `org_${orgName.toLowerCase().replace(/\s+/g, '_')}`;
    const orgDb = this.client.db(dbName);
    await orgDb.dropDatabase();
    return dbName;
  }

  async createIndex(collection, indexSpec, options = {}) {
    await collection.createIndex(indexSpec, options);
  }
}

export default DatabaseManager;
