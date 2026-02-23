import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "printe-40f70.firebaseapp.com",
    projectId: "printe-40f70",
    storageBucket: "printe-40f70.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// 🛑 THIS EXPORT IS THE MOST IMPORTANT PART
export const db = getFirestore(app);