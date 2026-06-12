'use client';

import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Info, Clock, User, CheckCircle2, UserPlus } from 'lucide-react';
import { useDebtContext } from '@/lib/DebtContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export function NotificationPopover() {
  const { analysis, lastUpdatedBy, debts, readAlertIds, markAllNotificationsAsRead } = useDebtContext();
  const { user, userRole } = useAuth();
  const router = useRouter();
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);

  const handleMarkAllAsRead = async () => {
    // 1. Mark local alerts as read
    markAllNotificationsAsRead();

    // 2. Mark database notifications as resolved in Firestore
    if (userRole === 'admin' && adminNotifications.length > 0) {
      try {
        const promises = adminNotifications.map(n => {
          const docRef = doc(db, 'notifications', n.id);
          return updateDoc(docRef, {
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolvedBy: user?.email || 'unknown'
          });
        });
        await Promise.all(promises);
      } catch (err) {
        console.error("Erreur lors de la résolution des notifications :", err);
      }
    }
  };

  useEffect(() => {
    if (!user || userRole !== 'admin') {
      setAdminNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: any[] = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() });
      });
      // Sort by createdAt desc
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAdminNotifications(notifs);
    }, (error) => {
      console.error("Erreur lors de l'écoute des notifications d'inscription :", error);
    });

    return () => unsubscribe();
  }, [user, userRole]);

  // Collect notifications from analysis alerts
  const alerts = analysis?.alerts || [];
  
  // Create collaborative notification if someone else updated
  const collaborativeNotif = lastUpdatedBy ? {
    id: 'collab_1',
    type: 'collaboration',
    message: `Dernière mise à jour par ${lastUpdatedBy}`,
    severity: 'low',
    clientName: 'Système'
  } : null;

  // Map db notifications to UI alerts
  const dbNotifsFormatted = adminNotifications.map(n => {
    const type = n.type || 'new_user';
    let severity = n.severity || 'low';
    let clientName = 'Notification';

    if (type === 'new_user') {
      severity = 'high';
      clientName = 'Nouveau Profil';
    } else if (type === 'payment') {
      severity = 'low';
      clientName = n.metadata?.clientName || 'Paiement';
    } else if (type === 'conflit') {
      severity = 'high';
      clientName = n.metadata?.clientName || 'Conflit';
    } else if (type === 'visit_reminder') {
      severity = 'medium';
      clientName = n.metadata?.clientName || 'Visite';
    } else {
      clientName = n.metadata?.clientName || 'Alerte';
    }

    return {
      id: n.id,
      type,
      message: n.message,
      severity,
      clientName,
      createdAt: n.createdAt,
      metadata: n.metadata,
      isDbNotification: true
    };
  });

  const allNotifications = [
    ...dbNotifsFormatted,
    ...(collaborativeNotif ? [collaborativeNotif] : []),
    ...alerts
  ];
  
  // Unread count: notifications not in readAlertIds (or always unread for new users until processed)
  const unreadNotifications = allNotifications.filter(n => n.isDbNotification || !readAlertIds.includes(n.id));
  const unreadCount = unreadNotifications.length;
  const highSeverityUnreadCount = unreadNotifications.filter(a => a.severity === 'high').length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors">
          <Bell className="h-4 w-4 text-gray-600" />
          {highSeverityUnreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white"></span>
            </span>
          )}
          {unreadCount > 0 && highSeverityUnreadCount === 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 mr-4 md:mr-6 rounded-2xl shadow-2xl border-0 overflow-hidden" align="end">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Notifications</h3>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
              {unreadCount} nouvelles
            </Badge>
          </div>
        </div>
        
        <ScrollArea className="h-[400px]">
          {allNotifications.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {allNotifications.map((notif: any) => {
                const isRead = notif.isDbNotification ? false : readAlertIds.includes(notif.id);
                return (
                  <div 
                    key={notif.id} 
                    onClick={() => {
                      if (notif.type === 'new_user') {
                        router.push('/settings');
                      } else if (notif.metadata?.clientName) {
                        router.push(`/clients?search=${encodeURIComponent(notif.metadata.clientName)}`);
                      }
                    }}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${isRead ? 'opacity-50 grayscale-[0.5]' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`
                        mt-1 p-2 rounded-xl flex-shrink-0
                        ${notif.type === 'new_user' ? 'bg-indigo-100 text-indigo-600' :
                          notif.type === 'conflit' ? 'bg-rose-100 text-rose-600' :
                          notif.type === 'payment' ? 'bg-emerald-100 text-emerald-600' :
                          notif.type === 'visit_reminder' ? 'bg-orange-100 text-orange-600' :
                          notif.severity === 'high' ? 'bg-red-100 text-red-600' : 
                          notif.type === 'collaboration' ? 'bg-blue-100 text-blue-600' :
                          'bg-amber-100 text-amber-600'}
                      `}>
                        {notif.type === 'new_user' ? <UserPlus className="h-4 w-4" /> :
                         notif.type === 'conflit' ? <AlertTriangle className="h-4 w-4" /> :
                         notif.type === 'payment' ? <CheckCircle2 className="h-4 w-4" /> :
                         notif.type === 'visit_reminder' ? <Clock className="h-4 w-4" /> :
                         notif.severity === 'high' ? <AlertTriangle className="h-4 w-4" /> :
                         notif.type === 'collaboration' ? <User className="h-4 w-4" /> :
                         <Clock className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {notif.clientName || 'Alerte'}
                          </span>
                          {!isRead && notif.severity === 'high' && (
                            <Badge variant="destructive" className="text-[9px] py-0 px-1">Urgent</Badge>
                          )}
                          {isRead && (
                            <CheckCircle2 className="h-3 w-3 text-gray-400" />
                          )}
                        </div>
                        <p className={`text-sm font-medium mt-0.5 leading-snug ${isRead ? 'text-gray-500' : 'text-gray-800'}`}>
                          {notif.message}
                        </p>
                        {notif.recommendation && (
                          <p className={`text-[11px] mt-1 font-medium p-1 rounded ${isRead ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                            💡 {notif.recommendation}
                          </p>
                        )}
                        {notif.type === 'new_user' && (
                          <p className="text-[10px] mt-1 font-bold text-indigo-600 animate-pulse">
                            👉 Cliquer pour affecter un rôle dans les paramètres
                          </p>
                        )}
                        {notif.type === 'visit_reminder' && (
                          <p className="text-[10px] mt-1 font-bold text-orange-600 animate-pulse">
                            👉 Cliquer pour voir le client concerné
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-gray-100 p-4 rounded-full mb-4">
                <CheckCircle2 className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">Tout est en ordre !</p>
              <p className="text-xs text-gray-400 mt-1">Aucune alerte critique détectée.</p>
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 bg-gray-50 border-t text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs text-blue-600 font-bold hover:text-blue-700 disabled:opacity-50"
            onClick={() => handleMarkAllAsRead()}
            disabled={unreadCount === 0}
          >
            Marquer tout comme lu
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
