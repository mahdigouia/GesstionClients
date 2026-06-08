'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from 'lucide-react';

interface PaymentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: 'versement' | 'espece' | 'traite' | 'cheque') => void;
  title: string;
  amount: number;
  targetName: string; // client name or invoice number
  isInvoice?: boolean;
}

export function PaymentConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  amount,
  targetName,
  isInvoice = false,
}: PaymentConfirmModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'versement' | 'espece' | 'traite' | 'cheque'>('versement');

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('versement');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm(paymentMethod);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[32px] border-0 shadow-2xl bg-white max-w-md p-6">
        <DialogHeader className="space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-black text-slate-900 text-center">
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm text-center leading-relaxed">
            Vous vous apprêtez à marquer {isInvoice ? "la facture" : "le client"}{" "}
            <span className="font-extrabold text-slate-800">{targetName}</span> comme{" "}
            <span className="font-bold text-emerald-600">entièrement réglé</span>.
            <br />
            Montant à solder :{" "}
            <span className="font-extrabold text-slate-800">
              {amount.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
            Mode de règlement
          </label>
          <div className="grid grid-cols-2 gap-2">
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
                className={`h-10 rounded-xl text-xs font-bold transition-all shadow-sm ${
                  paymentMethod === method.id
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white shadow-emerald-600/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setPaymentMethod(method.id as any)}
              >
                {method.label}
              </Button>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-slate-200 font-semibold hover:bg-slate-50 text-slate-600 px-6"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6"
          >
            Confirmer le règlement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
