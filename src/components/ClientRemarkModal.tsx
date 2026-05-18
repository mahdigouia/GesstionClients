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
  ArrowLeft,
  MapPin,
  PhoneCall,
  Mail,
  Coins,
  Calendar,
  ChevronRight,
  Trash2,
  Pencil,
  X,
  Check
} from 'lucide-react';
import { ClientRemark } from '@/types/debt';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';

interface ClientRemarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  remarks: ClientRemark[];
  onAddRemark: (clientName: string, content: string, promiseDate?: string, promiseAmount?: number) => void;
  onUpdateRemark?: (clientName: string, remarkId: string, content: string, promiseDate?: string, promiseAmount?: number) => void;
  onDeleteRemark?: (clientName: string, remarkId: string) => void;
}

export function ClientRemarkModal({ isOpen, onClose, clientName, remarks, onAddRemark, onUpdateRemark, onDeleteRemark }: ClientRemarkModalProps) {
  const { user } = useAuth();
  const [newRemark, setNewRemark] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editPromiseDate, setEditPromiseDate] = useState('');
  const [editPromiseAmount, setEditPromiseAmount] = useState('');

  const handleStartEdit = (remark: ClientRemark) => {
    setEditingRemarkId(remark.id);
    setEditContent(remark.content);
    setEditPromiseDate(remark.promiseDate ? new Date(remark.promiseDate).toISOString().split('T')[0] : '');
    setEditPromiseAmount(remark.promiseAmount ? remark.promiseAmount.toString() : '');
  };

  const handleSaveEdit = (remarkId: string) => {
    if (editContent.trim() && onUpdateRemark) {
      onUpdateRemark(clientName, remarkId, editContent.trim(), editPromiseDate || undefined, editPromiseAmount ? parseFloat(editPromiseAmount) : undefined);
      setEditingRemarkId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingRemarkId(null);
  };

  const [activeCategory, setActiveCategory] = useState<'none' | 'appel' | 'visite'>('none');

  const categories = [
    { id: 'appel', label: "Appel effectué", icon: <PhoneCall className="h-3 w-3" />, color: 'blue' },
    { id: 'visite', label: "Visite sur place", icon: <MapPin className="h-3 w-3" />, color: 'emerald' },
    { id: 'mail', label: "Mail envoyé", icon: <Mail className="h-3 w-3" />, color: 'slate' },
  ];

  const subOptions: Record<string, { label: string, text: string }[]> = {
    appel: [
      { label: "Ma hazzech", text: "Appel : Kalamtou w ma hazzech." },
      { label: "9ali ija (Date/Montant)", text: "Appel : Kalamtou w 9ali ija [DATE] pour paiement de [MONTANT]." },
    ],
    visite: [
      { label: "Mal9itech Gérant", text: "Visite : Mal9itech Gérant." },
      { label: "9ali arja3li (Date/Montant)", text: "Visite : 9ali arja3li [DATE] pour paiement de [MONTANT]." },
    ],
  };

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
            extractEntitiesFromTranscript(finalTranscript);
          }
        };

        const extractEntitiesFromTranscript = (text: string) => {
          // Extraction de la date (Format DD/MM/YYYY ou DD-MM-YYYY)
          const dateMatch = text.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
          if (dateMatch) {
            const [_, day, month, year] = dateMatch;
            setPromiseDate(`${year}-${month}-${day}`);
          }

          // Extraction du montant (Chiffres suivis de TND, DT, ou après le mot "montant")
          const amountMatch = text.match(/(\d+)\s*(?:TND|DT|dinars?)/i) || text.match(/(?:montant|paiement)\s*(?:de\s*)?(\d+)/i);
          if (amountMatch && amountMatch[1]) {
            setPromiseAmount(amountMatch[1]);
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

  const [lastAppliedDate, setLastAppliedDate] = useState('[DATE]');
  const [lastAppliedAmount, setLastAppliedAmount] = useState('[MONTANT]');

  useEffect(() => {
    // Gestion de la date
    const targetDateStr = promiseDate && promiseDate.length === 10 
      ? new Date(promiseDate).toLocaleDateString('fr-FR') 
      : '[DATE]';

    if (lastAppliedDate !== targetDateStr) {
      setNewRemark(prev => {
        if (prev.includes(lastAppliedDate)) {
          return prev.replace(lastAppliedDate, targetDateStr);
        }
        return prev;
      });
      setLastAppliedDate(targetDateStr);
    }
  }, [promiseDate, lastAppliedDate]);

  useEffect(() => {
    // Gestion du montant
    const targetAmountStr = promiseAmount 
      ? `${promiseAmount} TND` 
      : '[MONTANT]';

    if (lastAppliedAmount !== targetAmountStr) {
      setNewRemark(prev => {
        if (prev.includes(lastAppliedAmount)) {
          return prev.replace(lastAppliedAmount, targetAmountStr);
        }
        return prev;
      });
      setLastAppliedAmount(targetAmountStr);
    }
  }, [promiseAmount, lastAppliedAmount]);

  const handleAddTemplate = (templateText: string) => {
    let text = templateText;
    if (promiseDate && promiseDate.length === 10) {
      const formattedDate = new Date(promiseDate).toLocaleDateString('fr-FR');
      text = text.replace(/\[DATE\]/g, formattedDate);
    }
    if (promiseAmount) {
      text = text.replace(/\[MONTANT\]/g, `${promiseAmount} TND`);
    }
    setNewRemark(prev => prev + (prev ? ' ' : '') + text);
  };

  const handleSubmit = () => {
    if (newRemark.trim()) {
      let finalRemark = newRemark.trim();
      if (promiseDate && promiseDate.length === 10) {
        const formattedDate = new Date(promiseDate).toLocaleDateString('fr-FR');
        finalRemark = finalRemark.replace(/\[DATE\]/g, formattedDate);
      }
      if (promiseAmount) {
        finalRemark = finalRemark.replace(/\[MONTANT\]/g, `${promiseAmount} TND`);
      }
      onAddRemark(clientName, finalRemark, promiseDate || undefined, promiseAmount ? parseFloat(promiseAmount) : undefined);
      setNewRemark('');
      setPromiseDate('');
      setPromiseAmount('');
      setLastAppliedDate('[DATE]');
      setLastAppliedAmount('[MONTANT]');
      onClose();
    }
  };
      if (promiseAmount) {
        finalRemark = finalRemark.replace(/\[MONTANT\]/g, `${promiseAmount} TND`);
      }
      onAddRemark(clientName, finalRemark, promiseDate || undefined, promiseAmount ? parseFloat(promiseAmount) : undefined);
      setNewRemark('');
      setPromiseDate('');
      setPromiseAmount('');
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
                  {remarks.map((remark) => {
                    const isAuthor = user?.email && remark.user && user.email.toLowerCase() === remark.user.toLowerCase();
                    const remarkTime = new Date(remark.date).getTime();
                    const isWithin24h = (Date.now() - remarkTime) < 24 * 60 * 60 * 1000;
                    const isAdmin = user?.email && ['moslem.gouia@gmail.com', 'mahdigouia@gmail.com'].includes(user.email.toLowerCase());

                    const canDelete = isAdmin || (isAuthor && isWithin24h);
                    const canEdit = isAuthor && isWithin24h;
                    const isEditing = editingRemarkId === remark.id;

                    return (
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
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-black uppercase px-2 py-0.5">Enregistré</Badge>
                          {!isEditing && canEdit && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => handleStartEdit(remark)} title="Modifier la remarque (disponible 24h)">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isEditing && canDelete && onDeleteRemark && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => onDeleteRemark(clientName, remark.id)} title="Supprimer la remarque">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-3 pl-10">
                          <Textarea 
                            value={editContent} 
                            onChange={(e) => setEditContent(e.target.value)} 
                            className="text-sm font-medium p-3 min-h-[80px] rounded-xl border-slate-200"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-[10px] font-bold text-slate-400 mb-1 block">Date de promesse</Label>
                              <Input type="date" value={editPromiseDate} onChange={(e) => setEditPromiseDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="h-8 text-xs rounded-lg" />
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-400 mb-1 block">Montant (TND)</Label>
                              <Input type="number" value={editPromiseAmount} onChange={(e) => setEditPromiseAmount(e.target.value)} placeholder="0.000" className="h-8 text-xs rounded-lg" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" size="sm" onClick={handleCancelEdit} className="h-7 text-xs px-3 rounded-lg">
                              <X className="h-3 w-3 mr-1" /> Annuler
                            </Button>
                            <Button size="sm" onClick={() => handleSaveEdit(remark.id)} className="h-7 text-xs px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold">
                              <Check className="h-3 w-3 mr-1" /> Enregistrer
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-600 leading-relaxed font-medium pl-10 border-l-2 border-slate-50">
                            {remark.content}
                          </p>
                          {(remark.promiseDate || remark.promiseAmount) && (
                            <div className="mt-2 ml-10 flex flex-wrap items-center gap-3">
                              {remark.promiseDate && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-md">
                                  <Calendar className="h-3 w-3" />
                                  Promesse : {new Date(remark.promiseDate).toLocaleDateString('fr-FR')}
                                </div>
                              )}
                              {remark.promiseAmount && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-md">
                                  <Coins className="h-3 w-3" />
                                  Montant : {remark.promiseAmount.toLocaleString('fr-FR')} TND
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Saisie */}
          <div className="p-6 bg-white border-t border-slate-100 flex-shrink-0 space-y-4">
            {/* Templates Rapides */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modèles rapides</p>
                {activeCategory !== 'none' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setActiveCategory('none')}
                    className="h-6 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 gap-1 px-2"
                  >
                    <ArrowLeft className="h-2.5 w-2.5" /> Retour
                  </Button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {activeCategory === 'none' ? (
                  categories.map((cat) => (
                    <Button
                      key={cat.id}
                      variant="outline"
                      size="sm"
                      className={`h-8 rounded-full border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 gap-1.5 shadow-sm transition-all`}
                      onClick={() => {
                        if (cat.id === 'mail') {
                          handleAddTemplate("Relance par email envoyée ce jour. En attente de confirmation.");
                        } else {
                          setActiveCategory(cat.id as any);
                        }
                      }}
                    >
                      {cat.icon}
                      {cat.label}
                      {cat.id !== 'mail' && <ChevronRight className="h-3 w-3 opacity-50" />}
                    </Button>
                  ))
                ) : (
                  subOptions[activeCategory]?.map((opt, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-blue-100 bg-blue-50/50 text-[10px] font-bold text-blue-700 hover:bg-blue-100 gap-1.5 shadow-sm transition-all animate-in fade-in slide-in-from-left-2"
                      onClick={() => handleAddTemplate(opt.text)}
                    >
                      {opt.label}
                    </Button>
                  ))
                )}
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
                  min={new Date().toISOString().split('T')[0]}
                  className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promise-amount" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Coins className="h-3 w-3" /> Montant (Optionnel)
                </Label>
                <div className="relative">
                  <Input
                    id="promise-amount"
                    type="number"
                    placeholder="0.000"
                    value={promiseAmount}
                    onChange={(e) => setPromiseAmount(e.target.value)}
                    className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all h-10 pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">TND</span>
                </div>
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
