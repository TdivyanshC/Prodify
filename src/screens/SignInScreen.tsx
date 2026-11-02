import { AuthLayout } from '../components/Auth/AuthLayout';

interface SignInScreenProps {
  onSwitchToSignUp: () => void;
}

// Log in. Google is the only sign-in method, so this and Sign up run the same
// flow — a first-time Google account simply gets created on the server.
export function SignInScreen({ onSwitchToSignUp }: SignInScreenProps) {
  return (
    <AuthLayout
      sparkMessage="Welcome back! Ready to focus?"
      title="Welcome back"
      subtitle="Pick up your streak, your friends and your spaces where you left them."
      googleLabel="Continue with Google"
      switchPrompt="New to Prodify?"
      switchAction="Create an account"
      onSwitch={onSwitchToSignUp}
    />
  );
}
