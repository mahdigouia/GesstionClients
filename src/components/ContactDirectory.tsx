'use client';

import { useState, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Search, 
  User, 
  ExternalLink,
  PhoneCall,
  MessageSquare
} from 'lucide-react';
import { ClientDebt } from '@/types/debt';
import { useDebtContext } from '@/lib/DebtContext';

export function ContactDirectory() {
  const { debts } = useDebtContext();
  const [searchTerm, setSearchTerm] = useState('');

  // Extract unique clients with their latest phone numbers
  const contacts = useMemo(() => {
    const clientMap = new Map<string, { phone: string; totalBalance: number }>();
    
    debts.forEach(debt => {
      const existing = clientMap.get(debt.clientName);
      const phone = debt.clientPhone || existing?.phone || 'Non renseigné';
      const balance = (existing?.totalBalance || 0) + debt.balance;
      
      clientMap.set(debt.clientName, { phone, totalBalance: balance });
    });

    return Array.from(clientMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [debts]);

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-slate-50/50 rounded-3xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <PhoneCall className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Annuaire Clients</CardTitle>
              <p className="text-blue-100 text-xs">{contacts.length} contacts synchronisés</p>
            </div>
          </div>
        </div>
        
        <div className="relative mt-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200" />
          <Input
            placeholder="Rechercher un contact ou un numéro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-blue-200 rounded-xl focus:bg-white/20 transition-all border-2"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Aucun contact trouvé</p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div 
                key={contact.name} 
                className="flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{contact.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {contact.phone !== 'Non renseigné' && (
                    <Button 
                      size="sm" 
                      className="rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100 h-10 w-10 p-0"
                      asChild
                    >
                      <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <div className="text-right ml-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Solde</div>
                    <div className={`text-sm font-black ${contact.totalBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {contact.totalBalance.toLocaleString('fr-FR')} <span className="text-[10px]">TND</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
