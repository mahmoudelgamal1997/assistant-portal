import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDJ8HyRAm7z0RlgmYy3EjubVujy7E3ZBfA",
  authDomain: "drwaiting-30f56.firebaseapp.com",
  projectId: "drwaiting-30f56",
  storageBucket: "drwaiting-30f56.firebasestorage.app",
  messagingSenderId: "937005545176",
  appId: "1:937005545176:web:f52c92800c4c6c109f49ad",
  measurementId: "G-6G656KTDKB"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
