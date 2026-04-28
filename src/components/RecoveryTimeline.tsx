'use client';

import { RecoveryAction } from '@/types/debt';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Gavel, 
  MessageSquare,
  User,
  Clock
} from 'lucide-react';

interface RecoveryTimelineProps {
  actions: RecoveryAction[];
}

export function RecoveryTimeline({ actions }: RecoveryTimelineProps) {
  const getIcon = (type: RecoveryAction['type']) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'visit': return <MapPin className="h-4 w-4" />;
      case 'promise': return <Calendar className="h-4 w-4" />;
      case 'legal': return <Gavel className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getColor = (type: RecoveryAction['type']) => {
    switch (type) {
      case 'call': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'email': return 'bg-indigo-100 text-indigo-600 border-indigo-200';
      case 'visit': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'promise': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'legal': return 'bg-red-100 text-red-600 border-red-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getLabel = (type: RecoveryAction['type']) => {
    switch (type) {
      case 'call': return 'Appel Téléphonique';
      case 'email': return 'E-mail envoyé';
      case 'visit': return 'Visite sur place';
      case 'promise': return 'Promesse de paiement';
      case 'legal': return 'Action Juridique';
      default: return 'Autre action';
    }
  };

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
        <Clock className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">Aucune action enregistrée</p>
        <p className="text-sm text-gray-400 mt-1">Commencez par ajouter une action de recouvrement.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
      {actions.map((action, index) => (
        <div key={action.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Icon/Dot */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 bg-white">
            <div className={`p-2 rounded-full ${getColor(action.type)}`}>
              {getIcon(action.type)}
            </div>
          </div>

          {/* Content Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow group-hover:border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {format(new Date(action.date), 'dd MMM yyyy HH:mm', { locale: fr })}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getColor(action.type)}`}>
                  {getLabel(action.type)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded-full">
                <User className="h-3 w-3" />
                {action.user.split('@')[0]}
              </div>
            </div>
            
            <p className="text-sm text-slate-700 leading-relaxed italic">
              "{action.comment}"
            </p>

            {action.promiseDate && (
              <div className="mt-3 p-2 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2">
                <Calendar className="h-3 w-3 text-emerald-600" />
                <span className="text-[11px] font-bold text-emerald-700">
                  Promesse de règlement pour le : {format(new Date(action.promiseDate), 'dd/MM/yyyy')}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
