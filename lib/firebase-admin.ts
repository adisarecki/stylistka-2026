import 'server-only';
import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

export class FirebaseAdminConfigurationError extends Error {
  readonly code = 'SERVER_CONFIG_ERROR';
  readonly missingVariables: string[];

  constructor(missingVariables: string[]) {
    super(
      `Firebase Admin configuration error: Missing required environment variables [${missingVariables.join(', ')}]`
    );
    this.name = 'FirebaseAdminConfigurationError';
    this.missingVariables = missingVariables;
    Object.setPrototypeOf(this, FirebaseAdminConfigurationError.prototype);
  }
}

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const missing: string[] = [];
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!projectId) missing.push('FIREBASE_ADMIN_PROJECT_ID');
  if (!clientEmail) missing.push('FIREBASE_ADMIN_CLIENT_EMAIL');
  if (!rawPrivateKey) missing.push('FIREBASE_ADMIN_PRIVATE_KEY');
  if (!storageBucket) missing.push('FIREBASE_STORAGE_BUCKET');

  if (missing.length > 0) {
    throw new FirebaseAdminConfigurationError(missing);
  }

  let formattedKey = rawPrivateKey!;
  if (
    (formattedKey.startsWith('"') && formattedKey.endsWith('"')) ||
    (formattedKey.startsWith("'") && formattedKey.endsWith("'"))
  ) {
    formattedKey = formattedKey.slice(1, -1);
  }
  formattedKey = formattedKey.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: formattedKey,
    }),
    storageBucket,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}

export function getAdminBucket() {
  return getAdminStorage().bucket();
}
