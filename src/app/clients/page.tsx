'use client';

import { useState, useMemo } from 'react';
import { useDebtContext } from '@/lib/DebtContext';
import { Sidebar } from '@/components/Sidebar';
import { ExportService } from '@/lib/export';
import {
  Users,
  Search,
  FileSpreadsheet,
  FileText,
  Filter,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

export default function ClientsPage() {
  const { debts, analysis } = useDebtContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommercial, setSelectedCommercial] = useState('all');
  
  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientHistoryDebts, setClientHistoryDebts] = useState<any[]>([]);

  // Filtered client list
  const filteredClients = useMemo(() => {
    let list = analysis.clientBreakdown || [];
    
    if (selectedCommercial !== 'all') {
      list = list.filter((c: any) => c.commercialName === selectedCommercial);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((c: any) => 
        c.clientName.toLowerCase().includes(term) || 
        c.clientCode.toLowerCase().includes(term)
      );
    }
    
    return list;
  }, [analysis.clientBreakdown, selectedCommercial, searchTerm]);

  const commercialList = useMemo(() => {
    return Array.from(new Set((analysis.clientBreakdown || []).map((c: any) => c.commercialName)))
      .filter(Boolean)
      .sort();
  }, [analysis.clientBreakdown]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header Section */}
        <header className="bg-white border-b border-slate-200 px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
                <Users className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Portefeuille Clients</h1>
                <p className="text-slate-500 text-sm font-medium">
                  {filteredClients.length} clients identifiés sur {analysis.clientBreakdown?.length || 0}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-xl text-sm transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={selectedCommercial} onValueChange={setSelectedCommercial}>
                <SelectTrigger className="w-[200px] bg-white border-slate-200 rounded-xl">
                  <Filter className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Commercial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les commerciaux</SelectItem>
                  {commercialList.map(comm => (
                    <SelectItem key={comm} value={comm}>{comm}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-2">
                <Button 
                  variant="outline" 
                  onClick={() => ExportService.exportClientsToExcel(filteredClients)}
                  className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 rounded-xl h-10 px-4"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => ExportService.exportClientsToPDF(filteredClients)}
                  className="bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700 rounded-xl h-10 px-4"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-sm bg-white overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Facturé</p>
                      <h3 className="text-2xl font-bold text-slate-800 mt-1">
                        {filteredClients.reduce((s: any, c: any) => s + c.totalAmount, 0).toLocaleString('fr-FR')} TND
                      </h3>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                      <FileText className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 shadow-sm bg-white overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Réglé</p>
                      <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                        {filteredClients.reduce((s: any, c: any) => s + c.totalSettlement, 0).toLocaleString('fr-FR')} TND
                      </h3>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-white overflow-hidden group border-b-4 border-rose-500">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Solde Global</p>
                      <h3 className="text-2xl font-bold text-rose-600 mt-1">
                        {filteredClients.reduce((s: any, c: any) => s + c.totalBalance, 0).toLocaleString('fr-FR')} TND
                      </h3>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
                      <Users className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Client Cards Grid */}
            <div className="grid grid-cols-1 gap-4">
              {filteredClients.map((client: any, idx: number) => (
                <div 
                  key={idx}
                  onClick={() => {
                    setSelectedClientName(client.clientName);
                    setClientHistoryDebts(debts.filter(d => d.clientName === client.clientName));
                    setIsHistoryModalOpen(true);
                  }}
                  className="group relative flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner ${
                      client.totalBalance > 0 
                        ? 'bg-rose-50 text-rose-600' 
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {client.clientName?.[0] || '?'}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                          {client.sourceFile || '?'}
                        </span>
                        <h4 className="font-bold text-slate-800 text-lg group-hover:text-emerald-600 transition-colors">
                          {client.clientName}
                        </h4>
                        {client.totalBalance > 10000 && (
                          <Badge className="bg-rose-100 text-rose-600 border-rose-200">Critique</Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                        <span className="flex items-center gap-1.5 font-medium bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] text-slate-600">
                          ID: {client.clientCode}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          {client.debtCount} factures
                        </span>
                        <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {client.commercialName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className={`text-2xl font-black tracking-tight ${client.totalBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {client.totalBalance.toLocaleString('fr-FR')} <span className="text-sm font-normal opacity-60">TND</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Solde restant</div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
            
            {filteredClients.length === 0 && (
              <div className="text-center py-20">
                <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 inline-block">
                  <Users className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium">Aucun client trouvé pour ces critères.</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0 border-0 rounded-3xl shadow-2xl">
          <DialogHeader className="p-8 bg-gradient-to-r from-slate-900 to-blue-900 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-400" />
              Détails : {selectedClientName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 hover:bg-transparent">
                  <TableHead className="text-slate-500 font-bold">N° Facture</TableHead>
                  <TableHead className="text-slate-500 font-bold">Date</TableHead>
                  <TableHead className="text-slate-500 font-bold">Échéance</TableHead>
                  <TableHead className="text-slate-500 font-bold text-right">Montant</TableHead>
                  <TableHead className="text-slate-500 font-bold text-right">Réglé</TableHead>
                  <TableHead className="text-slate-500 font-bold text-right">Solde</TableHead>
                  <TableHead className="text-slate-500 font-bold text-center">Âge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientHistoryDebts.map((debt, i) => (
                  <TableRow key={i} className="border-slate-100 hover:bg-white transition-colors group">
                    <TableCell className="font-mono text-xs font-bold text-slate-600">{debt.documentNumber}</TableCell>
                    <TableCell className="text-sm text-slate-500">{new Date(debt.documentDate).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="text-sm text-slate-500">{new Date(debt.dueDate).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="text-sm font-bold text-slate-700 text-right">{debt.amount.toLocaleString('fr-FR')} TND</TableCell>
                    <TableCell className="text-sm font-bold text-emerald-600 text-right">{debt.payment.toLocaleString('fr-FR')} TND</TableCell>
                    <TableCell className="text-sm font-black text-rose-600 text-right">{debt.balance.toLocaleString('fr-FR')} TND</TableCell>
                    <TableCell className="text-center">
                      <Badge className={debt.age > 90 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}>
                        {debt.age} j
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
