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
  Check,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { ClientRemark } from '@/types/debt';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { useDebtContext } from '@/lib/DebtContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

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
  const { user, userRole } = useAuth();
  const { debts } = useDebtContext();
  const [newRemark, setNewRemark] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editPromiseDate, setEditPromiseDate] = useState('');
  const [editPromiseAmount, setEditPromiseAmount] = useState('');

  const clientDebts = debts.filter(d => d.clientName === clientName);
  const clientActiveDebts = clientDebts.filter(d => d.balance > 0);

  const adminEmails = ['moslem.gouia@gmail.com', 'mahdigouia@gmail.com'];
  const isAdmin = adminEmails.includes(user?.email || '') || userRole === 'admin';

  const handleResetPayments = async () => {
    if (confirm("Voulez-vous vraiment réinitialiser le statut 'Payé' pour ce client ? Cela supprimera toutes les remarques de paiement de l'historique et les notifications en attente.")) {
      try {
        // 1. Delete all remarks starting with "Payé" or "Payé Partiellement"
        const remarksToDelete = remarks.filter(r => r.content.startsWith('Payé') || r.content.startsWith('Payé Partiellement'));
        if (onDeleteRemark) {
          for (const r of remarksToDelete) {
            onDeleteRemark(clientName, r.id);
          }
        }

        // 2. Delete pending payments from Firestore
        const q = query(
          collection(db, 'pending_payments'),
          where('clientName', '==', clientName)
        );
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'pending_payments', docSnap.id)));
        await Promise.all(deletePromises);

        alert("Paiements et remarques réinitialisés avec succès !");
      } catch (err: any) {
        console.error("Erreur lors de la réinitialisation :", err);
        alert("Erreur : " + err.message);
      }
    }
  };

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

  const [selectedStatus, setSelectedStatus] = useState<'none' | 'reporte' | 'paye_partiel' | 'paye' | 'conflit'>('none');
  const [paymentMethod, setPaymentMethod] = useState<'versement' | 'espece' | 'traite' | 'cheque'>('versement');

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

  useEffect(() => {
    if (!isOpen) {
      setNewRemark('');
      setPromiseDate('');
      setPromiseAmount('');
      setSelectedStatus('none');
      setPaymentMethod('versement');
      setLastAppliedDate('[DATE]');
      setLastAppliedAmount('[MONTANT]');
    }
  }, [isOpen]);

  // Synchroniser automatiquement la date de prochaine visite dans le texte
  useEffect(() => {
    if (selectedStatus === 'reporte' && promiseDate) {
      const formattedDate = new Date(promiseDate).toLocaleDateString('fr-FR');
      setNewRemark(prev => {
        if (prev.startsWith("Reporté : Gérant non disponible")) {
          return `Reporté : Gérant non disponible. (Prochaine visite le ${formattedDate})`;
        }
        if (prev.startsWith("Reporté : Problème financier")) {
          return `Reporté : Problème financier. (Prochaine visite le ${formattedDate})`;
        }
        return prev;
      });
    }
  }, [promiseDate, selectedStatus]);

  // Synchroniser automatiquement le montant payé, le mode de règlement et la date de prochaine visite dans le texte
  useEffect(() => {
    if (selectedStatus === 'paye_partiel') {
      const amountVal = promiseAmount ? parseFloat(promiseAmount) : 0;
      const formattedAmount = amountVal > 0 
        ? `${amountVal.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`
        : '[MONTANT]';

      let methodText = '';
      if (paymentMethod === 'versement') methodText = `Versement de ${formattedAmount}`;
      else if (paymentMethod === 'espece') methodText = `Règlement en espèce de ${formattedAmount}`;
      else if (paymentMethod === 'traite') methodText = `Traite de ${formattedAmount}`;
      else if (paymentMethod === 'cheque') methodText = `Chèque de ${formattedAmount}`;

      const dateSuffix = promiseDate && promiseDate.length === 10
        ? ` (Prochaine visite le ${new Date(promiseDate).toLocaleDateString('fr-FR')})`
        : '';

      setNewRemark(`Payé Partiellement : ${methodText}.${dateSuffix}`);
    }
  }, [promiseAmount, paymentMethod, promiseDate, selectedStatus]);

  // Synchroniser automatiquement le mode de règlement dans le texte pour Payé (total)
  useEffect(() => {
    if (selectedStatus === 'paye') {
      const totalBal = clientActiveDebts.reduce((sum, d) => sum + d.balance, 0);
      const formattedAmount = totalBal > 0 
        ? `${totalBal.toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND`
        : '[MONTANT]';

      let methodText = 'Règlement total.';
      if (paymentMethod === 'versement') methodText = `Règlement total par versement de ${formattedAmount}`;
      else if (paymentMethod === 'espece') methodText = `Règlement total en espèce de ${formattedAmount}`;
      else if (paymentMethod === 'traite') methodText = `Règlement total par traite de ${formattedAmount}`;
      else if (paymentMethod === 'cheque') methodText = `Règlement total par chèque de ${formattedAmount}`;

      setNewRemark(`Payé : ${methodText}`);
    }
  }, [paymentMethod, selectedStatus, debts, clientName]);

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
      setSelectedStatus('none');
      setLastAppliedDate('[DATE]');
      setLastAppliedAmount('[MONTANT]');
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
              <div className="flex items-center gap-2">
                {isAdmin && remarks.some(r => r.content.startsWith('Payé')) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-black text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg px-2 flex items-center gap-1 border border-rose-100 transition-all shadow-sm"
                    onClick={handleResetPayments}
                    title="Réinitialiser tous les paiements et remarques 'Payé' de ce client"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Réinitialiser Paiements
                  </Button>
                )}
                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                  {remarks.length} entrée{remarks.length > 1 ? 's' : ''}
                </Badge>
              </div>
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
                    const isAdmin = userRole === 'admin' || (user?.email && ['moslem.gouia@gmail.com', 'mahdigouia@gmail.com'].includes(user.email.toLowerCase()));

                    const canDelete = isAdmin || (isAuthor && isWithin24h);
                    const canEdit = isAdmin || (isAuthor && isWithin24h);
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
            {/* Statuts de Relance (Nouveaux Modèles) */}
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut de la relance</p>
              <div className="flex flex-wrap gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-9 px-4 rounded-full font-bold text-xs shadow-sm transition-all duration-300 ${
                    selectedStatus === 'reporte'
                      ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                      : 'bg-orange-50/70 text-orange-700 border-orange-200 hover:bg-orange-100'
                  }`}
                  onClick={() => {
                    setSelectedStatus('reporte');
                    setPromiseAmount('');
                  }}
                >
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Reporté
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-9 px-4 rounded-full font-bold text-xs shadow-sm transition-all duration-300 ${
                    selectedStatus === 'paye_partiel'
                      ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                      : 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                  onClick={() => {
                    setSelectedStatus('paye_partiel');
                    setPromiseDate('');
                  }}
                >
                  <Coins className="h-3.5 w-3.5 mr-1.5" />
                  Payé Partiellement
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-9 px-4 rounded-full font-bold text-xs shadow-sm transition-all duration-300 ${
                    selectedStatus === 'paye'
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-emerald-50/70 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                  onClick={() => {
                    setSelectedStatus('paye');
                    setPromiseDate('');
                    const totalBal = clientActiveDebts.reduce((sum, d) => sum + d.balance, 0);
                    setPromiseAmount(totalBal.toString());
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Payé
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-9 px-4 rounded-full font-bold text-xs shadow-sm transition-all duration-300 ${
                    selectedStatus === 'conflit'
                      ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-rose-50/70 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                  onClick={() => {
                    setSelectedStatus('conflit');
                    setPromiseDate('');
                    setPromiseAmount('');
                    setNewRemark('Client à Conflit : ');
                  }}
                >
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Client à Conflit
                </Button>
              </div>
            </div>

            {/* Champs conditionnels selon le statut de relance */}
            {selectedStatus === 'reporte' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="promise-date" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-orange-500" />
                      <span>Date prochaine visite</span>
                    </Label>
                    <Input
                      id="promise-date"
                      type="date"
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all h-10 font-medium"
                    />
                  </div>
                  
                  {/* Modèles rapides de saisie textuelle pour Reporté */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Modèles de texte
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl border-slate-200 text-xs font-bold text-slate-600 hover:text-orange-600 hover:bg-orange-50 transition-all shadow-sm"
                        onClick={() => {
                          const dateSuffix = promiseDate ? ` (Prochaine visite le ${new Date(promiseDate).toLocaleDateString('fr-FR')})` : '';
                          setNewRemark(`Reporté : Gérant non disponible.${dateSuffix}`);
                        }}
                      >
                        Gérant non disponible
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl border-slate-200 text-xs font-bold text-slate-600 hover:text-orange-600 hover:bg-orange-50 transition-all shadow-sm"
                        onClick={() => {
                          const dateSuffix = promiseDate ? ` (Prochaine visite le ${new Date(promiseDate).toLocaleDateString('fr-FR')})` : '';
                          setNewRemark(`Reporté : Problème financier.${dateSuffix}`);
                        }}
                      >
                        Problème financier
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedStatus === 'paye_partiel' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Montant Payé */}
                  <div className="space-y-2">
                    <Label htmlFor="promise-amount" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      <span>Montant payé</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="promise-amount"
                        type="number"
                        placeholder="0.000"
                        value={promiseAmount}
                        onChange={(e) => setPromiseAmount(e.target.value)}
                        className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all h-10 pr-10 font-bold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">TND</span>
                    </div>
                  </div>

                  {/* Date Prochaine Visite (Optionnel) */}
                  <div className="space-y-2">
                    <Label htmlFor="promise-date" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-amber-500" />
                      <span>Date prochaine visite <span className="text-[8px] font-bold text-slate-400 lowercase italic">(Optionnel)</span></span>
                    </Label>
                    <Input
                      id="promise-date"
                      type="date"
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all h-10 font-medium"
                    />
                  </div>
                </div>

                {/* Mode de règlement */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    Mode de règlement
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'versement', label: 'Versement' },
                      { id: 'espece', label: 'Espèce' },
                      { id: 'traite', label: 'Traite' },
                      { id: 'cheque', label: 'Chèque' }
                    ].map(method => (
                      <Button
                        key={method.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-sm ${
                          paymentMethod === method.id
                            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setPaymentMethod(method.id as any)}
                      >
                        {method.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Reste non encore payé par facture si > 1 */}
                {clientActiveDebts.length > 1 && (
                  <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Reste non payé par facture :</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {clientActiveDebts.map((d) => (
                        <div 
                          key={d.id} 
                          className="flex justify-between items-center text-xs font-bold text-slate-700 bg-white px-3 py-2 border border-amber-100/60 rounded-xl shadow-sm"
                        >
                          <span className="text-slate-400 font-medium">{d.documentNumber} :</span>
                          <span className="text-amber-700">{d.balance.toFixed(3).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, " ")} TND</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedStatus === 'paye' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">Paiement intégral</p>
                    <p className="text-[10px] font-medium text-emerald-600">
                      Montant total soldé : <span className="font-bold">{clientActiveDebts.reduce((sum, d) => sum + d.balance, 0).toLocaleString('fr-TN', { minimumFractionDigits: 3 })} TND</span>
                    </p>
                  </div>
                </div>

                {/* Mode de règlement */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    Mode de règlement
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'versement', label: 'Versement' },
                      { id: 'espece', label: 'Espèce' },
                      { id: 'traite', label: 'Traite' },
                      { id: 'cheque', label: 'Chèque' }
                    ].map(method => (
                      <Button
                        key={method.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-sm ${
                          paymentMethod === method.id
                            ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setPaymentMethod(method.id as any)}
                      >
                        {method.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedStatus === 'conflit' && (
              <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center gap-3 animate-in fade-in duration-300">
                <AlertCircle className="h-6 w-6 text-rose-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-rose-800">Dossier en conflit</p>
                  <p className="text-[10px] font-medium text-rose-600">Veuillez détailler les raisons du litige dans la remarque ci-dessous.</p>
                </div>
              </div>
            )}

            <div className="relative group pt-2">
              <Textarea
                placeholder="Écrivez votre remarque ici..."
                className={`min-h-[120px] rounded-2xl border-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium p-4 resize-none transition-all ${isListening ? 'ring-2 ring-red-500 bg-red-50/30' : 'bg-slate-50/30 hover:bg-white'}`}
                value={newRemark}
                onChange={(e) => setNewRemark(e.target.value)}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  className={`h-10 w-10 rounded-xl transition-all ${isListening ? 'animate-pulse' : 'hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm'}`}
                  onClick={toggleListening}
                  title={isListening ? "Arrêter l'enregistrement" : "Enregistrer par la voix"}
                >
                  {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  type="button"
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
