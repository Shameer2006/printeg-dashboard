/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDcjOWaTWf2mR0ktLuYkl9LF0jXRToysyI",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "print-eg-be986.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "print-eg-be986",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "print-eg-be986.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "248272515175",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:248272515175:web:0b1676246c04d6c5bee4c2",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9WNTV7Q3H6"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
