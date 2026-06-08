'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Scale } from 'lucide-react';

interface ContentiousConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  invoiceNumber?: string;
}

export function ContentiousConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  invoiceNumber,
}: ContentiousConfirmModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="rounded-[32px] border-0 shadow-2xl bg-white max-w-md p-6">
        <AlertDialogHeader className="space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
            <Scale className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-xl font-black text-slate-900 text-center">
            Confirmer le passage en contentieux
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-500 font-medium text-sm text-center leading-relaxed">
            Êtes-vous sûr de vouloir marquer la facture{" "}
            <span className="font-extrabold text-rose-600">{invoiceNumber}</span> comme{" "}
            <strong className="text-slate-800">contentieuse</strong> ?
            <br />
            <br />
            Cela l'exclura des calculs de relance standard et du plan de relance actif.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 sm:justify-center gap-2">
          <AlertDialogCancel className="rounded-xl border-slate-200 font-semibold hover:bg-slate-50 text-slate-600 px-6">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold px-6"
          >
            Confirmer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
