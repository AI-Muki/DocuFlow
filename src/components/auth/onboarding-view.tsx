import React, { useState } from 'react';
import { Building2, Layers, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { slugify } from '../../lib/utils.ts';
import type { AuthSession, User } from '../../types/index.ts';

export interface OnboardingViewProps {
  user: User;
  onSuccess: (session: AuthSession) => void;
}

export function OnboardingView({ user, onSuccess }: OnboardingViewProps) {
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [deptName, setDeptName] = useState('General');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    setSlug(slugify(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/onboarding/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          slug: slug || slugify(orgName),
          departmentName: deptName || 'General',
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.data);
      } else {
        setError(data.error?.message || 'Failed to create organization');
      }
    } catch {
      setError('Unable to contact server during onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-md">
            DF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Your Organization</h1>
          <p className="text-xs text-slate-500">
            Welcome, {user.firstName}! Establish your multi-tenant workspace to begin.
          </p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Step 2: Workspace Partition</CardTitle>
            <CardDescription className="text-xs">
              You will be assigned the <span className="font-semibold text-slate-700">ORG_ADMIN</span> role for this
              tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Organization Name"
                placeholder="e.g. Acme Technologies"
                value={orgName}
                onChange={(e) => handleOrgNameChange(e.target.value)}
                leftIcon={<Building2 className="h-4 w-4" />}
                required
              />

              <Input
                label="Workspace URL Slug"
                placeholder="e.g. acme-technologies"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                helperText={`Your multi-tenant partition key: ${slug || 'your-slug'}`}
                required
              />

              <Input
                label="Initial Department"
                placeholder="e.g. Executive, IT, Operations"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                leftIcon={<Layers className="h-4 w-4" />}
                helperText="Initial business unit created automatically"
                required
              />

              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Complete Setup & Launch Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>

            <div className="rounded-md bg-blue-50/70 border border-blue-100 p-3 text-2xs text-blue-800 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Tenant Isolation Guarantee:</strong> Data created in this workspace will be cryptographically
                and logically isolated from all other organizations.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
