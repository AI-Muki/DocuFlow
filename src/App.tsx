import React, { useState, useEffect } from 'react';
import type { AuthSession, Organization, User } from './types/index.ts';
import { ToastProvider } from './components/ui/toast.tsx';
import { LoadingState } from './components/ui/loading-state.tsx';
import { LoginView } from './components/auth/login-view.tsx';
import { RegisterView } from './components/auth/register-view.tsx';
import { OnboardingView } from './components/auth/onboarding-view.tsx';
import { AppShell } from './components/layout/app-shell.tsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Restore authenticated session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setCurrentUser(data.data.user);
            setCurrentOrg(data.data.organization);
          }
        }
      } catch {
        // No active session
      } finally {
        setIsLoadingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleAuthSuccess = (session: AuthSession) => {
    setCurrentUser(session.user);
    setCurrentOrg(session.organization);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setCurrentUser(null);
      setCurrentOrg(null);
      setAuthView('login');
    }
  };

  const handleOrgUpdated = (updatedOrg: Organization) => {
    setCurrentOrg(updatedOrg);
  };

  if (isLoadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingState message="Initializing DocuFlow AI enterprise session..." />
      </div>
    );
  }

  return (
    <ToastProvider>
      {/* 1. Unauthenticated: Sign In */}
      {!currentUser && authView === 'login' && (
        <LoginView
          onSuccess={handleAuthSuccess}
          onNavigateRegister={() => setAuthView('register')}
        />
      )}

      {/* 2. Unauthenticated: Register */}
      {!currentUser && authView === 'register' && (
        <RegisterView
          onSuccess={handleAuthSuccess}
          onNavigateLogin={() => setAuthView('login')}
        />
      )}

      {/* 3. Authenticated but Needs Onboarding: Create Organization */}
      {currentUser && !currentOrg && (
        <OnboardingView
          user={currentUser}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* 4. Fully Authenticated with Organization Tenant: Application Shell */}
      {currentUser && currentOrg && (
        <AppShell
          user={currentUser}
          organization={currentOrg}
          onLogout={handleLogout}
          onOrganizationUpdated={handleOrgUpdated}
        />
      )}
    </ToastProvider>
  );
}
