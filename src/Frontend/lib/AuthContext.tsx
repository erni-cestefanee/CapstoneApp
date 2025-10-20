// src/Frontend/lib/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';

import supabase from './supabaseClient'; // adjust path if your client file lives elsewhere
import { useMsal } from '@azure/msal-react';

type UserShape = {
  id?: string | null; // uuid from your users table or supabase auth id
  email?: string | null;
  display_name?: string | null;
  roles?: string[] | null;
};

type AuthContextShape = {
  user: UserShape | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accounts } = useMsal(); // MsalProvider must wrap this
  const [user, setUser] = useState<UserShape | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const resolveMsalEmail = (acct: any) => {
    if (!acct) return null;
    return (
      acct.username ||
      (acct.idTokenClaims as any)?.email ||
      (acct.idTokenClaims as any)?.preferred_username ||
      (acct.idTokenClaims as any)?.upn ||
      null
    );
  };

  const loadProfileFromSupabase = async (opts?: { email?: string; authUserId?: string }) => {
    try {
      // Primary: lookup by email (MSAL provides email)
      if (opts?.email) {
        const { data, error } = await supabase
          .from('users')
          .select('id, email, display_name, roles')
          .eq('email', opts.email)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id ?? null,
            email: data.email ?? opts.email,
            display_name: data.display_name ?? null,
            roles: Array.isArray(data.roles) ? data.roles : data.roles ?? null,
          } as UserShape;
        }
      }

      // Secondary: lookup by auth user id (if you keep a mapping)
      if (opts?.authUserId) {
        const { data, error } = await supabase
          .from('users')
          .select('id, email, display_name, roles')
          .eq('id', opts.authUserId) // common convention: users.id == auth user id
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id ?? null,
            email: data.email ?? null,
            display_name: data.display_name ?? null,
            roles: Array.isArray(data.roles) ? data.roles : data.roles ?? null,
          } as UserShape;
        }
      }

      return null;
    } catch (err) {
      console.warn('AuthProvider: profile lookup failed', err);
      return null;
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const msalAccount = accounts?.[0] ?? null;
      const msalEmail = resolveMsalEmail(msalAccount);

      if (msalAccount && msalEmail) {
        const profile = await loadProfileFromSupabase({ email: msalEmail });
        if (profile) {
          setUser(profile);
          setLoading(false);
          return;
        }
      }

      // Fallback to Supabase session
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        setUser(null);
        setLoading(false);
        return;
      }
      const supUser = (userData as any)?.user;
      if (!supUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // try to find by id or email
      const profile = await loadProfileFromSupabase({ authUserId: supUser.id, email: supUser.email });
      if (profile) {
        setUser(profile);
        setLoading(false);
        return;
      }

  // If users table doesn't have a row for this auth user, include the supabase auth id
  // so downstream components can use it directly.
  setUser({ id: supUser.id, email: supUser.email ?? null, display_name: null, roles: null });
  setLoading(false);
    } catch (err) {
      console.warn('AuthProvider: refresh failed', err);
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // only re-run when accounts length changes (sign-in/out)
  }, [accounts?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('AuthProvider.logout: supabase.signOut failed', err);
    }

    try {
      const removeMsalKeys = (storage: Storage) => {
        for (let i = storage.length - 1; i >= 0; i--) {
          const key = storage.key(i);
          if (!key) continue;
          if (key.toLowerCase().includes('msal')) storage.removeItem(key);
        }
      };
      removeMsalKeys(window.sessionStorage);
      removeMsalKeys(window.localStorage);
    } catch (err) {
      console.warn('AuthProvider.logout: clearing MSAL storage failed', err);
    }

    setUser(null);
    window.location.href = window.location.origin;
  };

  const ctx: AuthContextShape = {
    user,
    loading,
    refresh,
    logout,
  };

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};