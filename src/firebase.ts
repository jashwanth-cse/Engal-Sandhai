// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "your api key",
  authDomain: "your Domain",
  projectId: "your project key",
  storageBucket: "your id",
  messagingSenderId: "ID",
  appId: "ID"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Disable authentication persistence - users must login every time
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error);
});
export const db = getFirestore(app);
export default app;