import * as admin from 'firebase-admin';

export function initAdmin(): void {
  if (admin.apps.length > 0) return;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
}

export function getDb(): admin.firestore.Firestore {
  initAdmin();
  return admin.firestore();
}

export const FieldValue = admin.firestore.FieldValue;
