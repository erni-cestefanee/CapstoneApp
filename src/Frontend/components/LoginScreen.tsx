import './styles/LoginScreen.css';

import React, { useEffect, useState } from 'react';

import erniLogo from '../assets/ERNI logo.png';
import { supabase } from '../lib/supabaseClient';

type LoginScreenProps = {
  onLogin?: (email?: string, role?: string) => void;
};

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('login-bg');
 
    return () => document.body.classList.remove('login-bg');
  }, []);

  
  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      console.log('🔍 LoginScreen: Checking for existing session...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('✅ Existing session found:', session.user);
        await handleUserLogin(session.user.email, session.user.id);
      } else {
        console.log('ℹ️ No existing session');
      }
    };

    checkSession();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    console.log('🔍 LoginScreen: Setting up auth state listener...');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state change:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session) {
        console.log('✅ User signed in, processing login...');
        await handleUserLogin(session.user.email, session.user.id);
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('ℹ️ User signed out');
        setProcessing(false);
        setShowConfirm(false);
      }
    });

    return () => {
      console.log('🔍 LoginScreen: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, [onLogin]);

  // Helper function to handle user login logic
  const handleUserLogin = async (email: string | undefined, userId: string) => {
    console.log('🔍 handleUserLogin called:', { email, userId });
    
    if (!email) {
      console.error('❌ No email found in session');
      setErrorMessage('No email found in session');
      setProcessing(false);
      return;
    }

    try {
      console.log('🔍 Fetching user profile from database...');
      
      // Fetch user profile from database to determine role
      let { data: profile, error } = await supabase
        .from('users')
        .select('roles')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        
        // If user doesn't exist in users table yet, wait for trigger to complete
        if (error.code === 'PGRST116') {
          console.log('⏳ User profile not found, waiting for trigger...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          // Try again
          const retryResult = await supabase
            .from('users')
            .select('roles')
            .eq('id', userId)
            .single();
          
          if (retryResult.error) {
            console.error('❌ Error fetching user profile on retry:', retryResult.error);
            
            // Last resort: Create the user manually
            console.log('⚠️ Trigger may have failed, creating user manually...');
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: email,
                roles: ['employee']
              })
              .select('roles')
              .single();
            
            if (createError) {
              console.error('❌ Failed to create user:', createError);
              setErrorMessage('Failed to create user profile. Please contact support.');
              setProcessing(false);
              return;
            }
            
            profile = newUser;
          } else {
            profile = retryResult.data;
          }
        } else {
          setErrorMessage('Failed to fetch user profile');
          setProcessing(false);
          return;
        }
      }

      // Determine role (case-insensitive). Map 'sul' and 'pl' to the SUL dashboard role.
      const roles = Array.isArray(profile?.roles) ? profile.roles : ['employee'];
      const normalizedRoles = roles.map((r: any) => String(r).toLowerCase());

      let role = 'employee';
      if (normalizedRoles.includes('admin')) {
        role = 'admin';
      } else if (normalizedRoles.includes('sul') || normalizedRoles.includes('pl')) {
        role = 'sul';
      } else if (normalizedRoles.includes('cx')) {
        // New: route CX users to CX area
        role = 'cx';
      }

      console.log('✅ User profile found, role:', role);
      setShowConfirm(true);
      setProcessing(false);
      setTimeout(() => {
        console.log('🚀 Calling onLogin with:', { email, role });
        onLogin?.(email, role);
      }, 600);
    } catch (err: any) {
      console.error('❌ Error processing login:', err);
      setErrorMessage(err.message ?? 'An error occurred during login');
      setProcessing(false);
    }
  };

  const handleLogin = async () => {
    setProcessing(true);
    setShowConfirm(false);
    setErrorMessage(null);

    console.log('🔍 Starting OAuth login...');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          // Basic scopes so users sign in without consenting to Graph calendar unless needed.
          scopes: 'openid profile email offline_access User.Read'
          // Do NOT set prompt: 'consent'
          // Optionally set redirectTo if you want a specific client-side callback:
          // redirectTo: window.location.origin + '/auth/callback'
        },

      });


      console.log('🔍 OAuth response:', { data, error });

      if (error) {
        throw error;
      }

      // If Supabase returned a URL, redirect explicitly (keeps behavior consistent)
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('❌ Login failed:', err);
      setErrorMessage(err.message ?? 'An unexpected error occurred during login');
      setProcessing(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* Left Side - ERNI Branding */}
      <div className="login-left-side">
        <div className="login-brand-container">
          <img 
            src={erniLogo} 
            alt="ERNI Logo" 
            className="login-erni-logo"
          />
          <h1 className="login-brand-title">PausePoint</h1>
          <p className="login-brand-subtitle">Manage your time off with ease</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="login-right-side">
        <div className="login-form-container">
          <h2 className="login-title">Sign in</h2>
          <p className="login-subtitle">Welcome back! Please sign in to continue</p>

          {errorMessage && (
            <div className="login-error-message">
              {errorMessage}
            </div>
          )}

          {showConfirm && (
            <div className="login-success-message">
              Login successful — redirecting...
            </div>
          )}

          <button 
            onClick={handleLogin} 
            type="button" 
            disabled={processing}
            className="login-microsoft-button"
          >
            <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
              <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
              <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
              <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
            </svg>
            <span>{processing ? 'Redirecting to Microsoft...' : 'Sign in with Microsoft'}</span>
          </button>

          <div className="login-divider">
            <div className="login-divider-line"></div>
            <p className="login-divider-text">Secure authentication via Azure AD</p>
            <div className="login-divider-line"></div>
          </div>

          <p className="login-info-text">
            Your Microsoft credentials are used to authenticate and access the application securely.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;