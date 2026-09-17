import { test, expect } from '@playwright/test';

test.describe('DocuFlow AI - Enterprise E2E Critical Flows', () => {
  test('User can sign in with pre-seeded demo account', async ({ page }) => {
    await page.goto('/');

    // Verify brand header
    await expect(page.locator('h1')).toContainText('DocuFlow AI');

    // Click quick demo login for Org Admin
    await page.getByRole('button', { name: 'Org Admin' }).click();

    // Click Sign In
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for Dashboard to render
    await expect(page.getByText('Welcome back')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Demo Corporation')).toBeVisible();
    await expect(page.getByText('Multi-tenant isolated')).toBeVisible();
  });

  test('User can switch to settings and inspect directory', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Org Admin' }).click();
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('Welcome back')).toBeVisible();

    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('Workspace Settings')).toBeVisible();

    // Switch to Users tab
    await page.getByRole('button', { name: /Users & Directory/ }).click();
    await expect(page.getByText('Organization Directory')).toBeVisible();
    await expect(page.getByText('admin@demo.local')).toBeVisible();

    // Switch to Roles tab
    await page.getByRole('button', { name: /Roles & Permissions/ }).click();
    await expect(page.getByText('Role-Based Access Control (RBAC)')).toBeVisible();
  });

  test('New User can register and onboard an organization', async ({ page }) => {
    const timestamp = Date.now();
    await page.goto('/');

    // Click Register new account
    await page.getByRole('button', { name: 'Register new account' }).click();
    await expect(page.getByText('Step 1: Account Registration')).toBeVisible();

    // Fill registration form
    await page.getByLabel('First Name').fill('Alex');
    await page.getByLabel('Last Name').fill('Mercer');
    await page.getByLabel('Work Email').fill(`alex.${timestamp}@nexus.com`);
    await page.getByLabel('Password').fill('Password123!');

    // Submit registration
    await page.getByRole('button', { name: 'Continue to Organization Setup' }).click();

    // Step 2: Workspace Partition Onboarding
    await expect(page.getByText('Step 2: Workspace Partition')).toBeVisible();
    await page.getByLabel('Organization Name').fill(`Nexus Global ${timestamp}`);
    await page.getByRole('button', { name: 'Complete Setup & Launch Dashboard' }).click();

    // Verify entered dashboard with new tenant
    await expect(page.getByText(`Nexus Global ${timestamp}`)).toBeVisible();
    await expect(page.getByText('Active Tenant:')).toBeVisible();
  });
});
