import fs from "fs";
import path from "path";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  Firestore,
  setLogLevel
} from "firebase/firestore";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");

// Suppress noisy warning logs from Firestore (such as benign idle gRPC stream disconnects)
try {
  setLogLevel("error");
} catch (e) {
  console.warn("Failed to set Firestore log level:", e);
}

let appInstance: any = null;
let firestoreDb: Firestore | null = null;
let isConfigured = false;

try {
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(rawConfig);
    const firebaseConfig = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId
    };
    
    appInstance = initializeApp(firebaseConfig);
    if (config.firestoreDatabaseId) {
      firestoreDb = getFirestore(appInstance, config.firestoreDatabaseId);
    } else {
      firestoreDb = getFirestore(appInstance);
    }
    isConfigured = true;
    console.log("[Firebase] Successfully initialized Firestore with ID:", config.firestoreDatabaseId || "default");
  } else {
    console.log("[Firebase] No firebase-applet-config.json file found. Operating in local mode.");
  }
} catch (err) {
  console.error("[Firebase] Error initializing firebase SDK:", err);
}

export { firestoreDb, isConfigured };
export { collection, doc, getDocs, getDoc, setDoc, deleteDoc, writeBatch };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

