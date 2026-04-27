'use client';

import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Info, Clock, User, CheckCircle2 } from 'lucide-react';
import { useDebtContext } from '@/lib/DebtContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function NotificationPopover() {
  const { analysis, lastUpdatedBy, debts } = useDebtContext();
  
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

  const allNotifications = collaborativeNotif ? [collaborativeNotif, ...alerts] : alerts;
  const highSeverityCount = alerts.filter(a => a.severity === 'high').length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors">
          <Bell className="h-4 w-4 text-gray-600" />
          {highSeverityCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0 mr-4 md:mr-6 rounded-2xl shadow-2xl border-0 overflow-hidden" align="end">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Notifications</h3>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 hover:bg-white/30">
              {allNotifications.length} nouvelles
            </Badge>
          </div>
        </div>
        
        <ScrollArea className="h-[400px]">
          {allNotifications.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {allNotifications.map((notif: any) => (
                <div key={notif.id} className="p-4 hover:bg-gray-50 transition-colors cursor-default">
                  <div className="flex gap-3">
                    <div className={`
                      mt-1 p-2 rounded-xl flex-shrink-0
                      ${notif.severity === 'high' ? 'bg-red-100 text-red-600' : 
                        notif.type === 'collaboration' ? 'bg-blue-100 text-blue-600' :
                        'bg-amber-100 text-amber-600'}
                    `}>
                      {notif.severity === 'high' ? <AlertTriangle className="h-4 w-4" /> :
                       notif.type === 'collaboration' ? <User className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {notif.clientName || 'Alerte'}
                        </span>
                        {notif.severity === 'high' && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1">Urgent</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-0.5 leading-snug">
                        {notif.message}
                      </p>
                      {notif.recommendation && (
                        <p className="text-[11px] text-blue-600 mt-1 font-medium bg-blue-50 p-1 rounded">
                          💡 {notif.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
          <Button variant="ghost" size="sm" className="text-xs text-blue-600 font-bold hover:text-blue-700">
            Marquer tout comme lu
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
