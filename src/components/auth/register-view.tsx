import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import type { AuthSession } from '../../types/index.ts';

export interface RegisterViewProps {
  onSuccess: (session: AuthSession) => void;
  onNavigateLogin: () => void;
}

export function RegisterView({ onSuccess, onNavigateLogin }: RegisterViewProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.data);
      } else {
        setError(data.error?.message || 'Registration failed');
      }
    } catch {
      setError('Unable to connect to authentication server');
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">DocuFlow AI</h1>
          <p className="text-xs text-slate-500">Create your enterprise administrator account</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Step 1: Account Registration</CardTitle>
            <CardDescription className="text-xs">
              Provide your details to set up your primary credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  leftIcon={<UserIcon className="h-4 w-4" />}
                  required
                />
                <Input
                  label="Last Name"
                  placeholder="Smith"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>

              <Input
                label="Work Email"
                type="email"
                placeholder="john.smith@enterprise.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                leftIcon={<Mail className="h-4 w-4" />}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="At least 8 characters (1 uppercase, 1 number)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                leftIcon={<Lock className="h-4 w-4" />}
                helperText="Must contain 8+ characters, uppercase letter, and number"
                required
              />

              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Continue to Organization Setup <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-500">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  className="font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
