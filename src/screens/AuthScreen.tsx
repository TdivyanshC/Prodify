import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';

// Signed-out entry point. Rendered outside NavigationContainer (App.tsx swaps
// it for the app once signed in, which lands on Home), so the Log in ↔
// Sign up switch is local state rather than a navigator.
export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const clearError = () => useAuthStore.setState({ error: null });
  return mode === 'signin' ? (
    <SignInScreen
      onSwitchToSignUp={() => {
        clearError();
        setMode('signup');
      }}
    />
  ) : (
    <SignUpScreen
      onSwitchToSignIn={() => {
        clearError();
        setMode('signin');
      }}
    />
  );
}
