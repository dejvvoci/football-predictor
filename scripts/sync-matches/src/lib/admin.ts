import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error('Mungon env variable FIREBASE_SERVICE_ACCOUNT (JSON i plotë i service account-it).');
  }

  initializeApp({
    credential: cert(JSON.parse(serviceAccountJson))
  });
}

export const db = getFirestore();
export { FieldValue };