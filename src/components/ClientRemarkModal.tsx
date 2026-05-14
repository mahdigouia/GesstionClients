'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Mic, 
  MicOff, 
  History, 
  Send, 
  User, 
  Clock, 
  CheckCircle2, 
  Trash2,
  PhoneCall,
  Mail,
  UserCheck,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { ClientRemark } from '@/types/debt';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ClientRemarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  remarks: ClientRemark[];
  onAddRemark: (clientName: string, content: string, promiseDate?: string) => void;
}

export function ClientRemarkModal({ isOpen, onClose, clientName, remarks, onAddRemark }: ClientRemarkModalProps) {
  const [newRemark, setNewRemark] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const templates = [
    { label: "Appel effectué", text: "Appel effectué : le client promet un règlement d'ici la fin de semaine.", icon: <PhoneCall className="h-3 w-3" /> },
    { label: "Mail envoyé", text: "Relance par email envoyée ce jour. En attente de confirmation.", icon: <Mail className="h-3 w-3" /> },
    { label: "Promesse tenue", text: "Promesse de règlement confirmée pour le montant total.", icon: <UserCheck className="h-3 w-3" /> },
    { label: "Litige déclaré", text: "Client déclare un litige sur une facture. Dossier en cours de vérification.", icon: <AlertCircle className="h-3 w-3" /> },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'fr-FR';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setNewRemark(prev => prev + ' ' + finalTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleAddTemplate = (templateText: string) => {
    setNewRemark(prev => prev + (prev ? ' ' : '') + templateText);
  };

  const handleSubmit = () => {
    if (newRemark.trim()) {
      onAddRemark(clientName, newRemark.trim(), promiseDate || undefined);
      setNewRemark('');
      setPromiseDate('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[90vh] md:h-auto md:max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white border-0 shadow-2xl rounded-[32px]">
        <DialogHeader className="p-6 md:p-8 bg-slate-900 text-white flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl md:text-2xl font-black tracking-tight">Suivi de Relance</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium text-sm md:text-base">
                Notes et remarques pour <span className="text-blue-400 font-bold">{clientName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Historique */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <History className="h-3 w-3" /> Historique des remarques
              </h3>
              <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                {remarks.length} entrée{remarks.length > 1 ? 's' : ''}
              </Badge>
            </div>
            
            <ScrollArea className="flex-1 p-6">
              {remarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <div className="p-4 bg-slate-100 rounded-full mb-4">
                    <MessageSquare className="h-8 w-8 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">Aucune remarque enregistrée pour le moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {remarks.map((remark) => (
                    <div key={remark.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800">{remark.user}</p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock className="h-3 w-3" />
                              {new Date(remark.date).toLocaleString('fr-FR')}
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-black uppercase px-2 py-0.5">Enregistré</Badge>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium pl-10 border-l-2 border-slate-50">
                        {remark.content}
                      </p>
                      {remark.promiseDate && (
                        <div className="mt-2 ml-10 flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-md">
                          <Calendar className="h-3 w-3" />
                          Promesse : {new Date(remark.promiseDate).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Saisie */}
          <div className="p-6 bg-white border-t border-slate-100 flex-shrink-0 space-y-4">
            {/* Templates Rapides */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modèles rapides</p>
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 gap-1.5 shadow-sm transition-all"
                    onClick={() => handleAddTemplate(tpl.text)}
                  >
                    {tpl.icon}
                    {tpl.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promise-date" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Date de promesse (Optionnel)
                </Label>
                <Input
                  id="promise-date"
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all h-10"
                />
              </div>
            </div>

            <div className="relative group">
              <Textarea
                placeholder="Écrivez votre remarque ici..."
                className={`min-h-[120px] rounded-2xl border-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium p-4 resize-none transition-all ${isListening ? 'ring-2 ring-red-500 bg-red-50/30' : 'bg-slate-50/30 hover:bg-white'}`}
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <Button
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  className={`h-10 w-10 rounded-xl transition-all ${isListening ? 'animate-pulse' : 'hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm'}`}
                  onClick={toggleListening}
                  title={isListening ? "Arrêter l'enregistrement" : "Enregistrer par la voix"}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!newRemark.trim()}
                  className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Enregistrer</span>
                </Button>
              </div>
              {isListening && (
                <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-full animate-bounce shadow-lg">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Écoute...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 md:p-6 border-t border-slate-50 bg-slate-50 flex flex-row justify-end items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="text-slate-500 hover:text-slate-800 font-bold rounded-xl"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
