'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initials: string;
  fullName: string;
  userRole: 'admin' | 'gestionnaire' | 'commercial' | 'pending' | null;
  commercialCode: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'gestionnaire' | 'commercial' | 'pending' | null>(null);
  const [commercialCode, setCommercialCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        const uid = currentUser.uid;
        const email = currentUser.email?.toLowerCase() || '';
        const adminEmails = ['moslem.gouia@gmail.com', 'mahdigouia@gmail.com'];
        const isDefaultAdmin = adminEmails.includes(email);

        // Écouter le document utilisateur dans Firestore
        const userDocRef = doc(db, 'users', uid);
        
        unsubscribeProfile = onSnapshot(userDocRef, async (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            
            // Auto-promotion en admin si l'email est dans la liste par défaut mais que le rôle ne correspond pas
            if (isDefaultAdmin && data.role !== 'admin') {
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
              setUserRole('admin');
              setCommercialCode(data.commercialCode || null);
            } else {
              setUserRole(data.role || 'pending');
              setCommercialCode(data.commercialCode || null);
            }
          } else {
            // Créer le document utilisateur s'il n'existe pas encore (ex. utilisateur déjà inscrit avant cette fonctionnalité)
            const defaultRole = isDefaultAdmin ? 'admin' : 'pending';
            const nameParts = currentUser.displayName?.split(' ') || ['Utilisateur'];
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';

            await setDoc(userDocRef, {
              uid,
              email,
              fullName: currentUser.displayName || 'Utilisateur',
              firstName,
              lastName,
              role: defaultRole,
              commercialCode: null,
              createdAt: new Date().toISOString()
            });

            setUserRole(defaultRole);
            setCommercialCode(null);

            // Créer la notification admin si ce n'est pas un admin par défaut
            if (defaultRole === 'pending') {
              await setDoc(doc(db, 'notifications', `new_user_${uid}`), {
                id: `new_user_${uid}`,
                type: 'new_user',
                message: `Nouvel utilisateur inscrit : ${currentUser.displayName || email} (${email})`,
                createdAt: new Date().toISOString(),
                status: 'pending',
                readBy: [],
                metadata: {
                  uid,
                  email,
                  fullName: currentUser.displayName || email
                }
              });
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Erreur lors de l'écoute du profil utilisateur :", error);
          setLoading(false);
        });
      } else {
        setUserRole(null);
        setCommercialCode(null);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('commercial_landed');
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Calculate initials from displayName
  const getInitials = (): string => {
    if (!user?.displayName) return '??';
    
    const names = user.displayName.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return user.displayName.slice(0, 2).toUpperCase();
  };

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    const emailNorm = email.toLowerCase();
    const fullName = `${firstName} ${lastName}`;
    
    // Update profile with full name
    await updateProfile(userCredential.user, {
      displayName: fullName,
    });

    const adminEmails = ['moslem.gouia@gmail.com', 'mahdigouia@gmail.com'];
    const isDefaultAdmin = adminEmails.includes(emailNorm);
    const defaultRole = isDefaultAdmin ? 'admin' : 'pending';

    // Créer le document de profil dans Firestore
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: emailNorm,
      fullName,
      firstName,
      lastName,
      role: defaultRole,
      commercialCode: null,
      createdAt: new Date().toISOString()
    });

    // Créer une notification pour les admins si le compte est "pending"
    if (defaultRole === 'pending') {
      await setDoc(doc(db, 'notifications', `new_user_${uid}`), {
        id: `new_user_${uid}`,
        type: 'new_user',
        message: `Nouvel utilisateur inscrit : ${fullName} (${emailNorm})`,
        createdAt: new Date().toISOString(),
        status: 'pending',
        readBy: [],
        metadata: {
          uid,
          email: emailNorm,
          fullName
        }
      });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value: AuthContextType = {
    user,
    loading,
    initials: getInitials(),
    fullName: user?.displayName || 'Utilisateur',
    userRole,
    commercialCode,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
