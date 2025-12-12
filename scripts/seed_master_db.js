import { MongoClient } from 'mongodb';
import config from '../src/config.js';
import { PasswordManager } from '../src/auth.js';

async function seedMasterDb() {
  let client;
  try {
    client = new MongoClient(config.mongoUrl);
    await client.connect();

    const db = client.db(config.masterDbName);
    const adminCollection = db.collection(config.adminCollection);
    const orgCollection = db.collection(config.masterCollection);

    // Create indexes
    await adminCollection.createIndex({ admin_email: 1 }, { unique: true });
    await orgCollection.createIndex({ organization_name: 1 }, { unique: true });

    console.log('Indexes created successfully');

    // Check if sample org already exists
    const existing = await orgCollection.findOne({ organization_name: 'Sample Org' });
    if (!existing) {
      // Create sample admin
      const password = 'sample_password_123';
      const hashedPassword = await PasswordManager.hashPassword(password);

      const adminResult = await adminCollection.insertOne({
        admin_email: 'admin@sample.com',
        password: hashedPassword,
        role: 'admin',
        organization_id: null,
        created_at: new Date(),
        is_active: true,
      });

      const orgResult = await orgCollection.insertOne({
        organization_name: 'Sample Org',
        db_name: 'org_sample_org',
        admin_email: 'admin@sample.com',
        admin_user_id: adminResult.insertedId.toString(),
        created_at: new Date(),
        is_active: true,
      });

      // Update admin with org ID
      await adminCollection.updateOne(
        { _id: adminResult.insertedId },
        { $set: { organization_id: orgResult.insertedId.toString() } }
      );

      console.log('Sample organization seeded successfully');
      console.log('Org ID:', orgResult.insertedId);
      console.log('Admin Email: admin@sample.com');
      console.log('Admin Password: sample_password_123');
    } else {
      console.log('Sample organization already exists');
    }
  } catch (error) {
    console.error('Seeding error:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

seedMasterDb();
