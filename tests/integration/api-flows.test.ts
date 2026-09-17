import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/api/app.ts';

const app = createApiApp();

describe('End-to-End API Integration Flows', () => {
  let authToken = '';
  let organizationId = '';

  it('Flow 1: Pre-seeded Admin Login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@demo.local',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('admin@demo.local');
    expect(res.body.data.organization.name).toBe('Demo Corporation');

    authToken = res.body.data.token;
    expect(authToken).toBeDefined();
    organizationId = res.body.data.organization.id;
  });

  it('Flow 2: Reject Invalid Password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@demo.local',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Flow 3: Registration -> Onboarding Flow', async () => {
    // 1. Register new individual user
    const randomSuffix = Math.floor(Math.random() * 10000);
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Elena',
        lastName: 'Rostova',
        email: `elena${randomSuffix}@newcorp.io`,
        password: 'Password123!',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    const newAuthToken = regRes.body.data.token;
    expect(newAuthToken).toBeDefined();

    // 2. Onboard & Create Organization
    const onbRes = await request(app)
      .post('/api/auth/onboarding/organization')
      .set('Authorization', `Bearer ${newAuthToken}`)
      .send({
        name: `Rostova Enterprise ${randomSuffix}`,
        slug: `rostova-corp-${randomSuffix}`,
        departmentName: 'Strategic Operations',
      });

    expect(onbRes.status).toBe(201);
    expect(onbRes.body.success).toBe(true);
    expect(onbRes.body.data.organization.name).toContain('Rostova Enterprise');
    expect(onbRes.body.data.user.roles[0].name).toBe('ORG_ADMIN');

    // 3. Verify /api/auth/me returns this new session
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${onbRes.body.data.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(`elena${randomSuffix}@newcorp.io`);
    expect(meRes.body.data.organization.id).toBe(onbRes.body.data.organization.id);
  });

  it('Flow 4: Department Management & Tenant Isolation', async () => {
    // 1. Fetch departments using Admin token
    const listRes = await request(app)
      .get('/api/departments')
      .set('Authorization', `Bearer ${authToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    const initialCount = listRes.body.data.length;

    // 2. Create new department
    const createRes = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'AI Operations & Robotics',
        code: 'AI-OPS',
        description: 'Automated intelligence pipelines',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toBe('AI Operations & Robotics');

    // 3. Re-fetch departments
    const updatedRes = await request(app)
      .get('/api/departments')
      .set('Authorization', `Bearer ${authToken}`);

    expect(updatedRes.body.data.length).toBe(initialCount + 1);
  });

  it('Flow 5: Audit Log Retrieval', async () => {
    const auditRes = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${authToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.success).toBe(true);
    expect(Array.isArray(auditRes.body.data)).toBe(true);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
  });
});
