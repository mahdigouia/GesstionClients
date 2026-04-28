'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecoveryAction } from '@/types/debt';
import { Calendar, MessageSquare, Phone, Mail, MapPin, Gavel } from 'lucide-react';

interface AddActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (action: Omit<RecoveryAction, 'id' | 'date' | 'user'>) => void;
  clientName: string;
}

export function AddActionModal({ isOpen, onClose, onSubmit, clientName }: AddActionModalProps) {
  const [type, setType] = useState<RecoveryAction['type']>('call');
  const [comment, setComment] = useState('');
  const [promiseDate, setPromiseDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    onSubmit({
      clientName,
      type,
      comment,
      promiseDate: promiseDate || undefined
    });

    // Reset form
    setComment('');
    setPromiseDate('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl shadow-2xl border-0">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Nouvelle Action : {clientName}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="type" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Type d'action
            </Label>
            <Select 
              value={type} 
              onValueChange={(val: any) => setType(val)}
            >
              <SelectTrigger className="rounded-xl border-slate-200">
                <SelectValue placeholder="Sélectionnez le type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="call">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-600" />
                    <span>Appel Téléphonique</span>
                  </div>
                </SelectItem>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-indigo-600" />
                    <span>E-mail envoyé</span>
                  </div>
                </SelectItem>
                <SelectItem value="visit">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-amber-600" />
                    <span>Visite sur place</span>
                  </div>
                </SelectItem>
                <SelectItem value="promise">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                    <span>Promesse de paiement</span>
                  </div>
                </SelectItem>
                <SelectItem value="legal">
                  <div className="flex items-center gap-2">
                    <Gavel className="h-4 w-4 text-red-600" />
                    <span>Action Juridique</span>
                  </div>
                </SelectItem>
                <SelectItem value="other">Autre action</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Commentaire / Notes
            </Label>
            <Textarea
              id="comment"
              placeholder="Détaillez l'échange avec le client..."
              className="min-h-[100px] rounded-xl border-slate-200 focus:ring-blue-500"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="promiseDate" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Date de promesse (Optionnel)
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="promiseDate"
                type="date"
                className="pl-9 rounded-xl border-slate-200"
                value={promiseDate}
                onChange={(e) => setPromiseDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="rounded-xl"
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              Enregistrer l'action
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
