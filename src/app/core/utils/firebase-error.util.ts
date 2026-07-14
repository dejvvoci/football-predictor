const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'This email is already used by another account.',
  'auth/invalid-email': 'Invalid email.',
  'auth/weak-password': 'Password is too weak (minimum 6 characters).',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with this email/username.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/too-many-requests': 'Too many failed attempts. Try again in a few minutes.',
  'auth/network-request-failed': 'Network connection problem.',
  'auth/operation-not-allowed': 'Email/Password isn\'t enabled in Firebase Console (Authentication → Sign-in method).',
  'permission-denied': 'Firestore refused the write (check Security Rules in Firebase Console).',
  'username/taken': 'This username is already taken. Try another one.'
};

export function mapFirebaseAuthError(code: string | undefined): string {
  if (code && MESSAGES[code]) {
    return MESSAGES[code];
  }
  return `Something went wrong${code ? ` (code: ${code})` : ''}. Please try again.`;
}
