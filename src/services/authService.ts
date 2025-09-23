// src/services/authService.ts
import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";

export const loginWithEmployeeID = (employeeID: string, phone: string) => {
  const email = `${employeeID.toUpperCase()}@engalsandhai.local`;
  return signInWithEmailAndPassword(auth, email, phone.toUpperCase());
};

export const logout = () => signOut(auth);

export const observeUser = (callback: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth, callback);
export { auth };