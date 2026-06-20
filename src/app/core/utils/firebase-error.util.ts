const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Ky email është përdorur tashmë nga një llogari tjetër.',
  'auth/invalid-email': 'Email i pavlefshëm.',
  'auth/weak-password': 'Fjalëkalimi është shumë i dobët (minimumi 6 karaktere).',
  'auth/invalid-credential': 'Email ose fjalëkalim i pasaktë.',
  'auth/user-not-found': 'Nuk gjendet llogari me këtë email.',
  'auth/wrong-password': 'Fjalëkalim i pasaktë.',
  'auth/too-many-requests': 'Shumë përpjekje të dështuara. Provo përsëri pas pak minutash.',
  'auth/network-request-failed': 'Problem me lidhjen e internetit.'
};

export function mapFirebaseAuthError(code: string | undefined): string {
  if (code && MESSAGES[code]) {
    return MESSAGES[code];
  }
  return 'Diçka shkoi keq. Provo përsëri.';
}