'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { ShieldAlert, Clock, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthGuardProps {
  children: React.ReactNode;
}

const publicRoutes = ['/login', '/register'];

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, userRole, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isPublicRoute = publicRoutes.includes(pathname);

    if (!user && !isPublicRoute) {
      router.push('/login');
    } else if (user && isPublicRoute) {
      if (userRole === 'commercial') {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('commercial_landed', 'true');
        }
        router.push('/clients');
      } else {
        router.push('/');
      }
    } else if (user && userRole === 'commercial' && pathname === '/import') {
      // Redirect commercials trying to import to their clients page
      router.push('/clients');
    } else if (user && userRole === 'commercial' && pathname === '/') {
      // Landing redirect for commercial accounts when opening the app or fresh session
      if (typeof window !== 'undefined') {
        const hasLanded = sessionStorage.getItem('commercial_landed');
        if (!hasLanded) {
          sessionStorage.setItem('commercial_landed', 'true');
          router.push('/clients');
        }
      }
    }
  }, [user, loading, userRole, pathname, router]);

  // Register Service Worker for push notifications when authenticated
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && user && userRole && userRole !== 'pending') {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[Service Worker] Registration successful with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('[Service Worker] Registration failed:', error);
        });
    }
  }, [user, userRole]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-blue-200/80 font-semibold tracking-wide animate-pulse">Chargement sécurisé...</p>
        </div>
      </div>
    );
  }

  const isPublicRoute = publicRoutes.includes(pathname);

  // If public route, render directly
  if (isPublicRoute) {
    return user ? null : <>{children}</>;
  }

  // If not logged in and not public, return null (handled by useEffect redirect)
  if (!user) {
    return null;
  }

  // If user is pending, show the beautiful pending screen
  if (userRole === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
        {/* Decorative ambient lights */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg bg-slate-900/60 border border-slate-800 backdrop-blur-2xl rounded-3xl p-8 text-center shadow-2xl relative z-10">
          <div className="mx-auto w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
            <Clock className="h-10 w-10 text-amber-400" />
          </div>

          <h2 className="text-3xl font-black text-white tracking-tight mb-3">
            Compte en attente d'activation
          </h2>
          
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Votre inscription a été enregistrée avec succès. Pour des raisons de sécurité, un administrateur doit vous affecter un rôle (<span className="text-slate-200 font-bold">Admin, Gestionnaire ou Commercial</span>) avant que vous ne puissiez accéder aux données.
          </p>

          <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-left mb-8 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Notification envoyée</h4>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Les administrateurs ont été notifiés pour valider votre compte.
              </p>
            </div>
          </div>

          <Button 
            onClick={handleLogout}
            className="w-full h-12 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
