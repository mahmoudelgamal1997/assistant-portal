import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [assistantData, setAssistantData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const assistantRef = doc(db, 'assistants', firebaseUser.uid);
          const assistantSnap = await getDoc(assistantRef);
          if (assistantSnap.exists()) {
            setAssistantData({ id: firebaseUser.uid, ...assistantSnap.data() });
          } else {
            setAssistantData({ id: firebaseUser.uid, email: firebaseUser.email });
          }
        } catch (err) {
          console.error('Error loading assistant data:', err);
          setAssistantData({ id: firebaseUser.uid, email: firebaseUser.email });
        }
      } else {
        setUser(null);
        setAssistantData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, assistantData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
