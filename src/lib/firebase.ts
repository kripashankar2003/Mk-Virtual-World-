import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCdmmDvodIZZZuidQnNPr0L-xWF2UarnNE',
  authDomain: 'mkvirtualworld-b4652.firebaseapp.com',
  databaseURL: 'https://mkvirtualworld-b4652-default-rtdb.firebaseio.com',
  projectId: 'mkvirtualworld-b4652',
  messagingSenderId: '356167174715',
  appId: '1:356167174715:web:bc379ba743ea4635a62a1e',
  measurementId: 'G-SXM3QRJMBQ',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const authReady = setPersistence(auth, browserLocalPersistence);
