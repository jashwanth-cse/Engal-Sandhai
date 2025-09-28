// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAkXcureBhW089DGWb2Wj1FGUBVevXYbmE",
  authDomain: "engal-sandhai.firebaseapp.com",
  projectId: "engal-sandhai",
  storageBucket: "engal-sandhai.firebasestorage.app",
  messagingSenderId: "224014608772",
  appId: "1:224014608772:web:8f06e393560dffad0f55d1"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Disable authentication persistence - users must login every time
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('Failed to set auth persistence:', error);
});
export const db = getFirestore(app);
export default app;