import request from 'supertest';
import DatabaseManager from './database.js';
import config from './config.js';
import app from './server.js';

// Test configuration
const TEST_ORG_NAME = 'Test Company';
const TEST_EMAIL = 'admin@testcompany.com';
const TEST_PASSWORD = 'testpassword123';

let authToken = null;

describe('Organization Management Service', () => {
  beforeAll(async () => {
    // Ensure database connection
    const dbManager = DatabaseManager.getInstance();
    try {
      await dbManager.connect();
    } catch (e) {
      // Already connected
    }
  });

  afterAll(async () => {
    // Cleanup
    const dbManager = DatabaseManager.getInstance();
    await dbManager.disconnect();
  });

  // Health Check Tests
  describe('Health Check', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  // Organization Creation Tests
  describe('Organization Creation', () => {
    test('POST /org/create should create a new organization', async () => {
      const response = await request(app)
        .post('/org/create')
        .send({
          organization_name: TEST_ORG_NAME,
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });

      expect(response.status).toBe(200);
      expect(response.body.organization_name).toBe(TEST_ORG_NAME);
      expect(response.body.db_name).toBe('org_test_company');
      expect(response.body.admin_email).toBe(TEST_EMAIL);
      expect(response.body.message).toBe('Organization created successfully');
    });

    test('POST /org/create should prevent duplicate organization names', async () => {
      const response = await request(app)
        .post('/org/create')
        .send({
          organization_name: TEST_ORG_NAME,
          email: 'another@testcompany.com',
          password: TEST_PASSWORD,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists');
    });

    test('POST /org/create should validate email format', async () => {
      const response = await request(app)
        .post('/org/create')
        .send({
          organization_name: 'Invalid Email Org',
          email: 'invalid-email',
          password: TEST_PASSWORD,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email');
    });
  });

  // Organization Retrieval Tests
  describe('Organization Retrieval', () => {
    test('GET /org/get should retrieve organization details', async () => {
      const response = await request(app)
        .get('/org/get')
        .query({ organization_name: TEST_ORG_NAME });

      expect(response.status).toBe(200);
      expect(response.body.organization_name).toBe(TEST_ORG_NAME);
      expect(response.body.admin_email).toBe(TEST_EMAIL);
    });

    test('GET /org/get should return 404 for non-existent organization', async () => {
      const response = await request(app)
        .get('/org/get')
        .query({ organization_name: 'Non Existent Org' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  // Authentication Tests
  describe('Authentication', () => {
    test('POST /admin/login should return JWT token', async () => {
      const response = await request(app)
        .post('/admin/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });

      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.token_type).toBe('bearer');
      expect(response.body.organization_name).toBe(TEST_ORG_NAME);

      // Save token for later tests
      authToken = response.body.access_token;
    });

    test('POST /admin/login should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/admin/login')
        .send({
          email: TEST_EMAIL,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    test('GET /admin/verify-token should verify valid token', async () => {
      const response = await request(app)
        .get('/admin/verify-token')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token is valid');
      expect(response.body.organization_name).toBe(TEST_ORG_NAME);
    });

    test('GET /admin/verify-token should fail without token', async () => {
      const response = await request(app).get('/admin/verify-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('missing');
    });
  });

  // Organization Update Tests
  describe('Organization Update', () => {
    test('PUT /org/update should update organization credentials', async () => {
      const response = await request(app)
        .put('/org/update')
        .send({
          organization_name: TEST_ORG_NAME,
          email: 'newemail@testcompany.com',
          password: 'newpassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Organization updated successfully');

      // Verify old password doesn't work
      const loginResponse = await request(app)
        .post('/admin/login')
        .send({
          email: 'newemail@testcompany.com',
          password: TEST_PASSWORD,
        });

      expect(loginResponse.status).toBe(401);

      // Verify new password works
      const newLoginResponse = await request(app)
        .post('/admin/login')
        .send({
          email: 'newemail@testcompany.com',
          password: 'newpassword123',
        });

      expect(newLoginResponse.status).toBe(200);
      authToken = newLoginResponse.body.access_token;
    });
  });

  // Organization Deletion Tests
  describe('Organization Deletion', () => {
    test('DELETE /org/delete should require authentication', async () => {
      const response = await request(app)
        .delete('/org/delete')
        .query({ organization_name: TEST_ORG_NAME });

      expect(response.status).toBe(401);
    });

    test('DELETE /org/delete should delete organization with valid token', async () => {
      const response = await request(app)
        .delete('/org/delete')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ organization_name: TEST_ORG_NAME });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Organization deleted successfully');
    });

    test('GET /org/get should return 404 after deletion', async () => {
      const response = await request(app)
        .get('/org/get')
        .query({ organization_name: TEST_ORG_NAME });

      expect(response.status).toBe(404);
    });
  });
});
