import { GOOGLE_AUTH_ENABLED, GOOGLE_WEB_CLIENT_ID } from '../api/config';

// Native Google Sign-In. Required lazily: the module doesn't exist in Expo Go,
// and a top-level import would crash the app there even with auth paused.

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');
let mod: GoogleSigninModule | null = null;

function load(): GoogleSigninModule {
  if (!GOOGLE_AUTH_ENABLED) throw new Error('Google sign-in is off in this build');
  if (!mod) {
    mod = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
    // webClientId makes Google mint an ID token our server can verify (its
    // audience). The Android client is matched by package name + SHA-1.
    mod.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  }
  return mod;
}

export class GoogleSignInCancelled extends Error {}

// Android reports a misconfigured OAuth client (package name / SHA-1 not
// registered — DEVELOPER_ERROR in logcat) as a plain "cancelled", with the
// picker flashing shut. No person cancels that fast, so treat it as an error
// instead of failing silently.
const INSTANT_CLOSE_MS = 1200;
const MISCONFIGURED =
  'Google sign-in closed before an account could be picked. This usually means the Android OAuth client’s package name or SHA-1 doesn’t match this build.';

// Opens Google's account picker. Resolves to an ID token, or throws
// GoogleSignInCancelled if the user backed out (not an error to show).
export async function getGoogleIdToken(): Promise<string> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = load();
  let openedAt = 0;
  const cancelled = () => (Date.now() - openedAt < INSTANT_CLOSE_MS ? new Error(MISCONFIGURED) : new GoogleSignInCancelled());
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    openedAt = Date.now();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw cancelled();
    if (!response.data.idToken) throw new Error('Google didn’t return an ID token — check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    return response.data.idToken;
  } catch (err) {
    if (err instanceof GoogleSignInCancelled || (err instanceof Error && err.message === MISCONFIGURED)) throw err;
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.IN_PROGRESS) throw new GoogleSignInCancelled();
      if (err.code === statusCodes.SIGN_IN_CANCELLED) throw cancelled();
      if (err.code === '10' || err.code === 'DEVELOPER_ERROR') throw new Error(MISCONFIGURED);
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play services is missing or out of date on this device');
      // DEVELOPER_ERROR (code 10) = package name / SHA-1 not registered on the Android OAuth client.
      throw new Error(`Google sign-in failed (${err.code}): ${err.message}`);
    }
    throw err;
  }
}

// Clears Google's cached account so the next sign-in shows the picker again.
export async function signOutOfGoogle(): Promise<void> {
  if (!GOOGLE_AUTH_ENABLED) return;
  try {
    await load().GoogleSignin.signOut();
  } catch {
    // already signed out — nothing to do
  }
}
