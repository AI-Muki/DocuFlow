import React from 'react';
import { LogOut, User as UserIcon, Shield, Building2 } from 'lucide-react';
import type { User, Organization } from '../../types/index.ts';
import { getInitials } from '../../lib/utils.ts';
import { Dropdown } from '../ui/dropdown.tsx';

export interface UserMenuProps {
  user: User;
  organization: Organization | null;
  onLogout: () => void;
  onNavigateSettings: () => void;
}

export function UserMenu({ user, organization, onLogout, onNavigateSettings }: UserMenuProps) {
  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const initials = getInitials(fullName);
  const primaryRole = user.roles?.[0]?.name || 'EMPLOYEE';

  const trigger = (
    <button className="flex items-center gap-2.5 rounded-full p-1 pl-2 text-left hover:bg-slate-100 transition-colors">
      <div className="flex flex-col text-right hidden sm:flex">
        <span className="text-xs font-semibold text-slate-800 leading-tight">{fullName}</span>
        <span className="text-2xs text-slate-500">{user.email}</span>
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-2xs font-bold text-white shadow-2xs">
        {initials}
      </div>
    </button>
  );

  return (
    <Dropdown
      trigger={trigger}
      align="right"
      items={[
        {
          id: 'user-profile',
          label: `${fullName} (${primaryRole})`,
          icon: <Shield className="h-3.5 w-3.5 text-blue-600" />,
          onClick: onNavigateSettings,
        },
        {
          id: 'org-info',
          label: organization?.name || 'No Organization',
          icon: <Building2 className="h-3.5 w-3.5 text-slate-400" />,
          disabled: true,
          onClick: () => {},
        },
        { divider: true },
        {
          id: 'settings',
          label: 'Account & Workspace Settings',
          icon: <UserIcon className="h-3.5 w-3.5" />,
          onClick: onNavigateSettings,
        },
        { divider: true },
        {
          id: 'logout',
          label: 'Sign Out',
          icon: <LogOut className="h-3.5 w-3.5" />,
          destructive: true,
          onClick: onLogout,
        },
      ]}
    />
  );
}
