/**
 * Authentication and Session Types
 */
import { Profile, OrganizationUnit, SystemRole } from './database';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  primaryUnit: OrganizationUnit | null;
  allUnits: OrganizationUnit[];
  systemRole: SystemRole | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  profileError: string | null;
  roleError: string | null;
  unitError: string | null;
  isRlsBlocked: boolean;
}

export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (allowedRoles: SystemRole[]) => boolean;
  isAdmin: boolean;
  isExecutiveOrAdmin: boolean;
}
