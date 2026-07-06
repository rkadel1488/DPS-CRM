import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Auto-detect long polling keeps the connection alive on older browsers,
// proxies, and unstable networks where WebChannel streaming fails.
// The persistent cache lets the app keep working from local data during
// brief network drops instead of crashing.
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  firebaseConfig.firestoreDatabaseId,
);

export default app;
