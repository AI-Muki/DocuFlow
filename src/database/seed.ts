// DocuFlow AI - Standalone Seed Script
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.ts';
import { store } from './store.ts';

async function main() {
  console.log('🌱 Starting DocuFlow AI database seed...');

  const devPassword = 'Password123!';
  const devPasswordHash = await bcrypt.hash(devPassword, 10);

  // If running with a live PostgreSQL instance via Prisma:
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('placeholder')) {
    try {
      console.log('Connecting to PostgreSQL via Prisma...');

      // 1. Seed Permissions
      const permissions = [
        { key: 'documents.read', action: 'read', resource: 'documents', description: 'View documents' },
        { key: 'documents.create', action: 'create', resource: 'documents', description: 'Create documents' },
        { key: 'documents.update', action: 'update', resource: 'documents', description: 'Update documents' },
        { key: 'documents.delete', action: 'delete', resource: 'documents', description: 'Delete documents' },
        { key: 'workflows.create', action: 'create', resource: 'workflows', description: 'Create workflows' },
        { key: 'workflows.manage', action: 'manage', resource: 'workflows', description: 'Manage workflows' },
        { key: 'approvals.approve', action: 'approve', resource: 'approvals', description: 'Approve items' },
        { key: 'users.manage', action: 'manage', resource: 'users', description: 'Manage users' },
        { key: 'users.read', action: 'read', resource: 'users', description: 'Read users' },
        { key: 'departments.manage', action: 'manage', resource: 'departments', description: 'Manage departments' },
        { key: 'organization.manage', action: 'manage', resource: 'organization', description: 'Manage organization' },
        { key: 'audit.read', action: 'read', resource: 'audit', description: 'Read audit logs' },
      ];

      for (const p of permissions) {
        await prisma.permission.upsert({
          where: { key: p.key },
          update: {},
          create: p,
        });
      }

      // 2. Seed Organization: Demo Corporation
      const demoOrg = await prisma.organization.upsert({
        where: { slug: 'demo-corp' },
        update: {},
        create: {
          name: 'Demo Corporation',
          slug: 'demo-corp',
          settings: {
            retentionDays: 90,
            enforceMFA: false,
          },
        },
      });

      console.log(`Created Organization: ${demoOrg.name} (${demoOrg.id})`);

      // 3. Seed Departments
      const deptNames = ['Finance', 'HR', 'IT', 'Legal'];
      const depts: Record<string, string> = {};
      for (const name of deptNames) {
        const d = await prisma.department.upsert({
          where: {
            organizationId_name: {
              organizationId: demoOrg.id,
              name,
            },
          },
          update: {},
          create: {
            name,
            code: name.substring(0, 3).toUpperCase(),
            organizationId: demoOrg.id,
          },
        });
        depts[name] = d.id;
      }

      // 4. Seed Users
      const usersToCreate = [
        { email: 'admin@demo.local', firstName: 'Admin', lastName: 'User', deptId: depts['IT'] },
        { email: 'manager@demo.local', firstName: 'Manager', lastName: 'User', deptId: depts['Finance'] },
        { email: 'employee@demo.local', firstName: 'Employee', lastName: 'User', deptId: depts['HR'] },
      ];

      for (const u of usersToCreate) {
        await prisma.user.upsert({
          where: { email: u.email },
          update: {},
          create: {
            email: u.email,
            passwordHash: devPasswordHash,
            firstName: u.firstName,
            lastName: u.lastName,
            organizationId: demoOrg.id,
            departmentId: u.deptId,
            isEmailVerified: true,
          },
        });
      }

      // 5. Seed Phase 2A Folders for Demo Corporation
      const folderNames = ['Finance', 'HR', 'Legal', 'IT', 'Projects'];
      const adminUser = await prisma.user.findUnique({ where: { email: 'admin@demo.local' } });
      if (adminUser) {
        for (const fName of folderNames) {
          await prisma.folder.upsert({
            where: {
              organizationId_parentFolderId_name: {
                organizationId: demoOrg.id,
                parentFolderId: null,
                name: fName,
              },
            },
            update: {},
            create: {
              organizationId: demoOrg.id,
              name: fName,
              createdById: adminUser.id,
            },
          });
        }

        // 6. Seed Phase 2A Document Types & Field Definitions
        const docTypes = [
          { name: 'Invoice', description: 'Vendor invoices and billing notices' },
          { name: 'Contract', description: 'Legal agreements and contracts' },
          { name: 'Purchase Order', description: 'Procurement and purchasing orders' },
          { name: 'Employee Document', description: 'Employee records and HR documents' },
          { name: 'Receipt', description: 'Expense receipts and receipts' },
        ];

        for (const dt of docTypes) {
          await prisma.documentType.upsert({
            where: {
              organizationId_name: {
                organizationId: demoOrg.id,
                name: dt.name,
              },
            },
            update: {},
            create: {
              organizationId: demoOrg.id,
              name: dt.name,
              description: dt.description,
            },
          });
        }

        // 7. Seed Phase 2A Tags
        const tags = ['Urgent', 'Confidential', 'Finance', 'Legal', 'Internal'];
        for (const tagName of tags) {
          await prisma.tag.upsert({
            where: {
              organizationId_name: {
                organizationId: demoOrg.id,
                name: tagName,
              },
            },
            update: {},
            create: {
              organizationId: demoOrg.id,
              name: tagName,
            },
          });
        }
      }

      console.log('✅ PostgreSQL database seeded successfully with Phase 1 & Phase 2A records.');
    } catch (err: unknown) {
      console.warn('PostgreSQL database not currently available, seeded in-memory store instead:', (err as Error).message);
    }
  }

  // Ensure repository store defaults are populated
  store.seedDefaults();
  console.log('✅ In-memory enterprise store seeded with Demo Corporation.');
  console.log('Credentials:');
  console.log('  Admin:    admin@demo.local    / Password123!');
  console.log('  Manager:  manager@demo.local  / Password123!');
  console.log('  Employee: employee@demo.local / Password123!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  });
