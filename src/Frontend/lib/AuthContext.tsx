// src/Frontend/lib/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react';

import supabase from './supabaseClient'; // adjust path if your client file lives elsewhere
import { useMsal } from '@azure/msal-react';

type UserShape = {
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
  const { accounts, instance } = useMsal(); // MsalProvider must wrap this
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
        // Try to exchange MSAL id_token for a Supabase session so
        // supabase.auth.getUser() returns a session and client-side RLS policies work.
        try {
          // acquire an id_token from MSAL silently; fall back to popup if needed
          let authResult: any = null;
          try {
            authResult = await (instance as any).acquireTokenSilent({ account: msalAccount, scopes: ['openid', 'profile', 'email'] });
          } catch (silentErr) {
            try {
              authResult = await (instance as any).acquireTokenPopup({ scopes: ['openid', 'profile', 'email'] });
            } catch (popupErr) {
              console.warn('MSAL token acquisition failed', silentErr, popupErr);
              authResult = null;
            }
          }

          const idToken = authResult?.idToken ?? authResult?.id_token ?? (msalAccount as any)?.idToken ?? null;
          if (idToken) {
            try {
              // Exchange id token for a Supabase session (requires Azure provider configured in Supabase)
              // supabase-js typings accept { token }
              const { error: signInError } = await supabase.auth.signInWithIdToken({ provider: 'azure', token: idToken as string });
              if (signInError) console.warn('supabase signInWithIdToken error', signInError);
            } catch (e) {
              console.warn('supabase signInWithIdToken threw', e);
            }
          }

        } catch (e) {
          console.warn('MSAL -> Supabase session exchange failed', e);
        }

        // After attempting to establish a supabase session, try to load profile by email
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

        // Ensure a minimal users row exists so UI components can read display_name/email
        try {
          const fallbackDisplay = supUser.email ?? supUser.user_metadata?.full_name ?? supUser.user_metadata?.name ?? null;
          // try to pull name parts from MSAL id token claims if available
          const msalAccount = accounts?.[0] ?? null;
          const givenName = (msalAccount as any)?.idTokenClaims?.given_name ?? supUser.user_metadata?.given_name ?? supUser.user_metadata?.first_name ?? null;
          const surname = (msalAccount as any)?.idTokenClaims?.family_name ?? supUser.user_metadata?.family_name ?? supUser.user_metadata?.last_name ?? null;

          // upsert silently to avoid blocking UI; include given_name/surname when available
          const upsertPayload: any = { id: supUser.id, email: supUser.email, display_name: fallbackDisplay };
          if (givenName) upsertPayload.given_name = givenName;
          if (surname) upsertPayload.surname = surname;

          await supabase.from('users').upsert(upsertPayload, { onConflict: 'id' });
        } catch (e) {
          // ignore upsert errors (roles/other constraints may apply)
          console.debug('users upsert failed', e);
        }

      // try to find by id or email
      const profile = await loadProfileFromSupabase({ authUserId: supUser.id, email: supUser.email });
      if (profile) {
        setUser(profile);
        setLoading(false);
        return;
      }

      setUser(null);
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