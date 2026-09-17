import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import type { AuthSession } from '../../types/index.ts';

export interface LoginViewProps {
  onSuccess: (session: AuthSession) => void;
  onNavigateRegister: () => void;
}

export function LoginView({ onSuccess, onNavigateRegister }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.data);
      } else {
        setError(data.error?.message || 'Authentication failed');
      }
    } catch {
      setError('Unable to reach authentication server');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setError('');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-md">
            DF
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">DocuFlow AI</h1>
          <p className="text-xs text-slate-500">Enterprise Document Management & Workflow Automation</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Sign In to Your Workspace</CardTitle>
            <CardDescription className="text-xs">
              Enter your enterprise credentials to access your organization's partition
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
                label="Work Email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                required
              />

              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Sign In <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>

            {/* Quick Demo Logins Section */}
            <div className="border-t border-slate-100 pt-4 mt-4">
              <p className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
                Pre-Seeded Demo Accounts (Password: Password123!)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDemoCredentials('admin@demo.local')}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-2xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span className="block font-semibold text-slate-900">Org Admin</span>
                  <span className="text-3xs text-slate-500 truncate block">admin@demo.local</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('manager@demo.local')}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-2xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span className="block font-semibold text-slate-900">Manager</span>
                  <span className="text-3xs text-slate-500 truncate block">manager@demo.local</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoCredentials('employee@demo.local')}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-2xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span className="block font-semibold text-slate-900">Employee</span>
                  <span className="text-3xs text-slate-500 truncate block">employee@demo.local</span>
                </button>
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-500">
                New organization?{' '}
                <button
                  type="button"
                  onClick={onNavigateRegister}
                  className="font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Register new account
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Phase 1 Badge Footer */}
        <div className="flex items-center justify-center gap-1.5 text-2xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Multi-Tenant Architecture &bull; Phase 1 Foundation</span>
        </div>
      </div>
    </div>
  );
}
