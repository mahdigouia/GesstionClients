import { ClientDebt, AnalysisResult } from '@/types/debt';

export interface VoiceCommand {
  intent: string;
  entities: {
    client?: string;
    documentNumber?: string;
    commercial?: string;
    period?: string;
  };
  confidence: number;
}

export interface VoiceResponse {
  message: string;
  data?: {
    invoices?: ClientDebt[];
    total?: number;
    count?: number;
    clientName?: string;
    commercialName?: string;
    documentNumber?: string;
    invoice?: ClientDebt;
    breakdown?: any[];
    avgAge?: number;
    alerts?: any[];
    clients?: ClientDebt[];
    [key: string]: any;
  };
  intent: string;
}

// Intent patterns with regex for French voice commands
const INTENT_PATTERNS = {
  GET_UNPAID_INVOICES_BY_CLIENT: {
    patterns: [
      /factures? non payées? (?:de|du|pour) (.+)/i,
      /créances? (?:de|du|pour) (.+)/i,
      /(?:donne|montre|affiche) .* (?:factures?|créances?) .* (?:de|du|pour) (.+)/i,
      /(?:quelles? sont) .* (?:factures?|créances?) .* (?:de|du|pour) (.+)/i,
      /(?:liste|lister) .* (?:factures?|créances?) .* (?:de|du|pour) (.+)/i,
      /(.+) .* (?:factures?|créances?) .* non payées?/i
    ],
    responseType: 'invoices_list'
  },
  
  GET_TOTAL_DEBTS: {
    patterns: [
      /total (?:des)? créances?/i,
      /combien (?:on|nous) doit/i,
      /montant total/i,
      /(?:donne|quel est) .* total/i,
      /(?:somme|montant) (?:de|des)? créances?/i,
      /(?:combien|quel) .* (?:argent|dinars?|tnd)/i
    ],
    responseType: 'total_amount'
  },
  
  GET_CRITICAL_ALERTS: {
    patterns: [
      /alertes? critiques?/i,
      /créances? critiques?/i,
      /(?:risques?|problèmes?) critiques?/i,
      /(?:donne|montre|affiche) .* alertes?/i,
      /(?:quelles? sont) .* (?:alertes?|risques?)/i,
      /(?:problèmes?|soucis?) (?:importants?|critiques?)/i
    ],
    responseType: 'alerts_list'
  },
  
  GET_CLIENT_BALANCE: {
    patterns: [
      /(?:solde|doit) (?:de|du|pour) (.+)/i,
      /combien (?:doit|doivent) (.+)/i,
      /(?:quel est) .* (?:solde|montant) .* (?:de|du) (.+)/i,
      /(.+) .* (?:doit|doivent) .* (?:combien|quoi)/i
    ],
    responseType: 'client_balance'
  },
  
  GET_INVOICES_BY_COMMERCIAL: {
    patterns: [
      /(?:documents?|factures?) (?:de|du) (.+) (?:commercial|représentant)/i,
      /(?:commercial|représentant) (.+)/i,
      /(?:donne|montre|affiche) .* (?:de|du) (.+) (?:commercial|représentant)/i,
      /(?:portefeuille|clients?) (?:de|du) (.+) (?:commercial|représentant)/i
    ],
    responseType: 'commercial_invoices'
  },
  
  GET_OVERDUE_INVOICES: {
    patterns: [
      /(?:factures?|créances?) (?:en retard|dépassées?|retard)/i,
      /(?:dépassé|retard) (?:de|des)? paiement/i,
      /(?:vieilles?|anciennes?) (?:créances?|factures?)/i,
      /(?:combien|quel) .* (?:dépassé|retard)/i
    ],
    responseType: 'overdue_list'
  },
  
  GET_INVOICE_DETAILS: {
    patterns: [
      /(?:détails?|info|informations?) (?:de|sur|pour) (?:la)? (?:facture|pièce|document) (.+)/i,
      /(?:facture|pièce|document) (.+)/i,
      /(?:donne|montre|affiche) .* (?:détails?|info) .* (?:facture|pièce|document)? (.+)/i
    ],
    responseType: 'invoice_details'
  },
  
  GET_CONTENTIEUX: {
    patterns: [
      /contentieux?/i,
      /litiges?/i,
      /(?:problèmes?|difficultés?) (?:contentieux|juridiques?)/i,
      /(?:créances?) (?:contentieux|litigieuses?)/i,
      /(?:passé|passer?) (?:en)? contentieux/i
    ],
    responseType: 'contentieux_list'
  },
  
  GET_AGING_SUMMARY: {
    patterns: [
      /(?:répartition|réparti) (?:par)? (?:âge|ancienneté)/i,
      /(?:ancienneté|âge) (?:des)? (?:créances?|factures?)/i,
      /(?:vieillesse|durée) (?:des)? créances?/i,
      /(?:combien|quel) .* (?:jours?|temps)/i
    ],
    responseType: 'aging_summary'
  },
  
  GET_ALL_CLIENTS: {
    patterns: [
      /(?:liste|lister|tous) (?:les)? clients?/i,
      /(?:donne|montre|affiche) .* clients?/i,
      /(?:quelles? sont) .* clients?/i,
      /(?:combien|nombre) (?:de)? clients?/i
    ],
    responseType: 'clients_list'
  },
  
  GET_ALL_COMMERCIALS: {
    patterns: [
      /(?:liste|lister|tous) (?:les)? (?:commerciaux?|représentants?)/i,
      /(?:donne|montre|affiche) .* (?:commerciaux?|représentants?)/i,
      /(?:quelles? sont) .* (?:commerciaux?|représentants?)/i,
      /(?:combien|nombre) (?:de)? (?:commerciaux?|représentants?)/i
    ],
    responseType: 'commercials_list'
  },
  
  GET_TOP_RISKS: {
    patterns: [
      /(?:top|plus) (?:grands?)? risques?/i,
      /(?:clients?|créances?) (?:à|en) risque/i,
      /(?:priorité|prioritaires?)/i,
      /(?:urgences?|urgent)/i
    ],
    responseType: 'top_risks'
  }
};

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

// Calculate similarity score (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return (maxLength - distance) / maxLength;
}

// Find best matching client name
function findBestClientMatch(query: string, debts: ClientDebt[]): { name: string; code: string; score: number } | null {
  let bestMatch = null;
  let bestScore = 0.5; // Slightly lower threshold for smarter matching
  
  const uniqueClients = new Map<string, { name: string; code: string }>();
  debts.forEach(d => {
    if (!uniqueClients.has(d.clientCode)) {
      uniqueClients.set(d.clientCode, { name: d.clientName, code: d.clientCode });
    }
  });

  const queryLower = query.toLowerCase().trim();
  
  uniqueClients.forEach(client => {
    const nameLower = client.name.toLowerCase();
    
    // 1. Exact match (Score: 1.0)
    if (nameLower === queryLower) {
      bestScore = 1.1; // Force win
      bestMatch = { name: client.name, code: client.code, score: 1.1 };
      return;
    }

    // 2. Similarity match (Levenstein)
    const nameScore = calculateSimilarity(queryLower, nameLower);
    
    // 3. Word start match (Score: 0.9) - matches "Meddeb" in "Societe Meddeb"
    // On vérifie si la requête est le début d'un des mots du nom du client
    const words = nameLower.split(/[\s,.'"]+/);
    const startsWithWord = words.some(word => word.startsWith(queryLower) || queryLower.startsWith(word));
    const wordScore = startsWithWord ? 0.9 : 0;
    
    // 4. Contains match (Score: 0.7) - simple inclusion anywhere
    const containsScore = nameLower.includes(queryLower) ? 0.7 : 0;
    
    const maxScore = Math.max(nameScore, wordScore, containsScore);
    
    if (maxScore > bestScore) {
      bestScore = maxScore;
      bestMatch = { name: client.name, code: client.code, score: maxScore };
    }
  });
  
  return bestMatch;
}

// Find best matching commercial
function findBestCommercialMatch(query: string, debts: ClientDebt[]): { name: string; score: number } | null {
  let bestMatch = null;
  let bestScore = 0.6;
  
  const uniqueCommerciaux = new Set<string>();
  debts.forEach(d => {
    if (d.commercialName) uniqueCommerciaux.add(d.commercialName);
  });
  
  uniqueCommerciaux.forEach(commercial => {
    const score = calculateSimilarity(query, commercial);
    const containsScore = commercial.toLowerCase().includes(query.toLowerCase()) ? 0.8 : 0;
    const maxScore = Math.max(score, containsScore);
    
    if (maxScore > bestScore) {
      bestScore = maxScore;
      bestMatch = { name: commercial, score: maxScore };
    }
  });
  
  return bestMatch;
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'TND',
    minimumFractionDigits: 2
  }).format(amount).replace('TND', 'dinars');
}

// Format number
function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

// Build response message
function buildResponse(intent: string, data: any): string {
  switch (intent) {
    case 'GET_UNPAID_INVOICES_BY_CLIENT': {
      const { clientName, invoices, total } = data;
      if (invoices.length === 0) {
        return `Je n'ai trouvé aucune facture non payée pour ${clientName}.`;
      }
      const lines = invoices.map((inv: ClientDebt, i: number) => 
        `${i + 1}. ${inv.documentNumber}: ${formatCurrency(inv.balance)}${inv.isContentieux ? ' (contentieux)' : ''}`
      );
      return `J'ai trouvé ${invoices.length} facture${invoices.length > 1 ? 's' : ''} non payée${invoices.length > 1 ? 's' : ''} pour ${clientName}:\n${lines.join('\n')}\n\nTotal: ${formatCurrency(total)}`;
    }
    
    case 'GET_TOTAL_DEBTS': {
      return `Le total des créances est de ${formatCurrency(data.total)} réparti sur ${data.count} documents.`;
    }
    
    case 'GET_CRITICAL_ALERTS': {
      if (data.alerts.length === 0) {
        return 'Il n\'y a aucune alerte critique pour le moment.';
      }
      const lines = data.alerts.slice(0, 5).map((alert: any, i: number) => 
        `${i + 1}. ${alert.clientName}: ${alert.message}`
      );
      return `J'ai identifié ${data.alerts.length} alerte${data.alerts.length > 1 ? 's' : ''} critique${data.alerts.length > 1 ? 's' : ''}:\n${lines.join('\n')}`;
    }
    
    case 'GET_CLIENT_BALANCE': {
      return `${data.clientName} doit actuellement ${formatCurrency(data.total)} réparti sur ${data.count} facture${data.count > 1 ? 's' : ''}.`;
    }
    
    case 'GET_INVOICES_BY_COMMERCIAL': {
      if (data.invoices.length === 0) {
        return `Je n'ai trouvé aucun document pour le commercial ${data.commercialName}.`;
      }
      const totalBalance = data.invoices.reduce((sum: number, inv: ClientDebt) => sum + inv.balance, 0);
      const uniqueClients = new Set(data.invoices.map((inv: ClientDebt) => inv.clientCode)).size;
      return `Le commercial ${data.commercialName} a ${data.invoices.length} document${data.invoices.length > 1 ? 's' : ''} pour ${uniqueClients} client${uniqueClients > 1 ? 's' : ''}, représentant un total de ${formatCurrency(totalBalance)}.`;
    }
    
    case 'GET_OVERDUE_INVOICES': {
      if (data.invoices.length === 0) {
        return 'Il n\'y a aucune facture en retard.';
      }
      const lines = data.invoices.slice(0, 5).map((inv: ClientDebt, i: number) => 
        `${i + 1}. ${inv.documentNumber} (${inv.clientName}): ${formatCurrency(inv.balance)} - ${inv.age} jours de retard`
      );
      return `Il y a ${data.invoices.length} facture${data.invoices.length > 1 ? 's' : ''} en retard pour un total de ${formatCurrency(data.total)}:\n${lines.join('\n')}${data.invoices.length > 5 ? '\n... et d\'autres' : ''}`;
    }
    
    case 'GET_INVOICE_DETAILS': {
      const inv = data.invoice;
      if (!inv) {
        return `Je n'ai pas trouvé la facture ${data.documentNumber}.`;
      }
      return `Détails de la facture ${inv.documentNumber}:\nClient: ${inv.clientName}\nMontant: ${formatCurrency(inv.amount)}\nSolde: ${formatCurrency(inv.balance)}\nÂge: ${inv.age} jours\nRisque: ${inv.riskLevel}${inv.isContentieux ? '\nStatus: Contentieux' : ''}`;
    }
    
    case 'GET_CONTENTIEUX': {
      if (data.invoices.length === 0) {
        return 'Il n\'y a aucun contentieux enregistré.';
      }
      const lines = data.invoices.slice(0, 5).map((inv: ClientDebt, i: number) => 
        `${i + 1}. ${inv.clientName} - ${inv.documentNumber}: ${formatCurrency(inv.balance)}`
      );
      return `Il y a ${data.invoices.length} contentieux pour un total de ${formatCurrency(data.total)}:\n${lines.join('\n')}`;
    }
    
    case 'GET_AGING_SUMMARY': {
      const lines = data.breakdown.map((range: any) => 
        `${range.range}: ${range.count} factures pour ${formatCurrency(range.amount)} (${range.percentage.toFixed(1)}%)`
      );
      return `Répartition des créances par ancienneté:\n${lines.join('\n')}\n\nÂge moyen: ${data.avgAge} jours`;
    }
    
    case 'GET_ALL_CLIENTS': {
      return `Il y a actuellement ${data.count} clients avec des créances.`;
    }
    
    case 'GET_ALL_COMMERCIALS': {
      return `Il y a ${data.count} commerciaux avec des clients actifs.`;
    }
    
    case 'GET_TOP_RISKS': {
      if (data.clients.length === 0) {
        return 'Aucun risque critique identifié.';
      }
      const lines = data.clients.slice(0, 5).map((client: ClientDebt, i: number) => 
        `${i + 1}. ${client.clientName}: ${formatCurrency(client.balance)} - ${client.age} jours`
      );
      return `Les principaux risques sont:\n${lines.join('\n')}`;
    }
    
    default:
      return 'Je n\'ai pas compris votre demande. Essayez: "factures non payées de [client]", "total des créances", "alertes critiques", etc.';
  }
}

// Main processing function
export const voiceNLP = {
  processCommand(command: string, debts: ClientDebt[], analysis: AnalysisResult | null): VoiceResponse {
    const lowerCommand = command.toLowerCase().trim();
    
    // Try to match each intent
    for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of config.patterns) {
        const match = lowerCommand.match(pattern);
        if (match) {
          // Extract entity if present
          const entity = match[1] ? match[1].trim() : undefined;
          return this.executeIntent(intent, entity, debts, analysis);
        }
      }
    }
    
    // No intent matched - try to find if it looks like a client name
    const clientMatch = findBestClientMatch(lowerCommand, debts);
    if (clientMatch && clientMatch.score > 0.7) {
      return this.executeIntent('GET_UNPAID_INVOICES_BY_CLIENT', clientMatch.name, debts, analysis);
    }
    
    // Default fallback
    const response = {
      message: 'Je n\'ai pas compris votre demande. Essayez:\n• "Factures non payées de [client]"\n• "Total des créances"\n• "Alertes critiques"\n• "Contentieux"\n• "Créances en retard"',
      intent: 'UNKNOWN'
    };
    return processResponse(response as VoiceResponse);
  },
  
  executeIntent(intent: string, entity: string | undefined, debts: ClientDebt[], analysis: AnalysisResult | null): VoiceResponse {
    let response: VoiceResponse;

    switch (intent) {
      case 'GET_UNPAID_INVOICES_BY_CLIENT': {
        const clientName = entity || '';
        const clientMatch = findBestClientMatch(clientName, debts);
        
        if (!clientMatch) {
          response = {
            message: `Je n'ai pas trouvé de client correspondant à "${clientName}".`,
            intent,
            data: { clientName, invoices: [], total: 0 }
          };
          break;
        }
        
        const invoices = debts.filter(d => 
          d.clientCode === clientMatch.code && d.balance > 0
        );
        
        const total = invoices.reduce((sum, d) => sum + d.balance, 0);
        
        response = {
          message: '',
          intent,
          data: {
            clientName: clientMatch.name,
            invoices,
            total
          }
        };
        break;
      }
      
      case 'GET_TOTAL_DEBTS': {
        const total = debts.reduce((sum, d) => sum + d.balance, 0);
        response = {
          message: '',
          intent,
          data: { total, count: debts.length }
        };
        break;
      }
      
      case 'GET_CRITICAL_ALERTS': {
        const alerts = analysis?.alerts?.filter(a => a.severity === 'high') || [];
        response = {
          message: '',
          intent,
          data: { alerts, count: alerts.length }
        };
        break;
      }
      
      case 'GET_CLIENT_BALANCE': {
        const clientName = entity || '';
        const clientMatch = findBestClientMatch(clientName, debts);
        
        if (!clientMatch) {
          response = {
            message: `Je n'ai pas trouvé de client correspondant à "${clientName}".`,
            intent,
            data: { clientName, total: 0, count: 0 }
          };
          break;
        }
        
        const clientDebts = debts.filter(d => d.clientCode === clientMatch.code && d.balance > 0);
        const total = clientDebts.reduce((sum, d) => sum + d.balance, 0);
        
        response = {
          message: '',
          intent,
          data: {
            clientName: clientMatch.name,
            total,
            count: clientDebts.length
          }
        };
        break;
      }
      
      case 'GET_INVOICES_BY_COMMERCIAL': {
        const commercialName = entity || '';
        const commercialMatch = findBestCommercialMatch(commercialName, debts);
        
        if (!commercialMatch) {
          response = {
            message: `Je n'ai pas trouvé de commercial correspondant à "${commercialName}".`,
            intent,
            data: { commercialName, invoices: [] }
          };
          break;
        }
        
        const invoices = debts.filter(d => d.commercialName === commercialMatch?.name);
        
        response = {
          message: '',
          intent,
          data: {
            commercialName: commercialMatch.name,
            invoices,
            count: invoices.length
          }
        };
        break;
      }
      
      case 'GET_OVERDUE_INVOICES': {
        const invoices = debts.filter(d => d.riskLevel === 'overdue' || d.riskLevel === 'critical');
        const total = invoices.reduce((sum, d) => sum + d.balance, 0);
        
        response = {
          message: '',
          intent,
          data: { invoices, total, count: invoices.length }
        };
        break;
      }
      
      case 'GET_INVOICE_DETAILS': {
        const docNumber = entity || '';
        const invoice = debts.find(d => 
          d.documentNumber.toLowerCase() === docNumber.toLowerCase()
        );
        
        response = {
          message: '',
          intent,
          data: { documentNumber: docNumber, invoice }
        };
        break;
      }
      
      case 'GET_CONTENTIEUX': {
        const invoices = debts.filter(d => d.isContentieux);
        const total = invoices.reduce((sum, d) => sum + d.balance, 0);
        
        response = {
          message: '',
          intent,
          data: { invoices, total, count: invoices.length }
        };
        break;
      }
      
      case 'GET_AGING_SUMMARY': {
        const breakdown = analysis?.agingBreakdown || [];
        const avgAge = debts.length > 0 
          ? Math.round(debts.reduce((sum, d) => sum + d.age, 0) / debts.length)
          : 0;
        
        response = {
          message: '',
          intent,
          data: { breakdown, avgAge }
        };
        break;
      }
      
      case 'GET_ALL_CLIENTS': {
        const uniqueClients = new Set(debts.map(d => d.clientCode)).size;
        response = {
          message: '',
          intent,
          data: { count: uniqueClients }
        };
        break;
      }
      
      case 'GET_ALL_COMMERCIALS': {
        const uniqueCommerciaux = new Set(debts.filter(d => d.commercialName).map(d => d.commercialName)).size;
        response = {
          message: '',
          intent,
          data: { count: uniqueCommerciaux }
        };
        break;
      }
      
      case 'GET_TOP_RISKS': {
        const clients = debts
          .filter(d => d.riskLevel === 'critical' || d.riskLevel === 'overdue')
          .sort((a, b) => b.balance - a.balance);
        
        response = {
          message: '',
          intent,
          data: { clients, count: clients.length }
        };
        break;
      }
      case 'GET_CLIENT_PHONE': {
        const clientName = entity || '';
        const clientMatch = findBestClientMatch(clientName, debts);
        
        if (!clientMatch) {
          response = {
            message: `Je n'ai pas trouvé de client correspondant à "${clientName}".`,
            intent,
            data: { clientName, invoices: [], total: 0 }
          };
          break;
        }

        // Find phone number in the client's debts
        const clientDebts = debts.filter(d => d.clientCode === clientMatch.code);
        let phone = '';
        for (const d of clientDebts) {
          if (d.clientPhone) {
            phone = d.clientPhone;
            break;
          }
        }

        if (phone) {
          response = {
            message: `Le numéro de téléphone de ${clientMatch.name} est le ${phone}.`,
            intent,
            data: { clientName: clientMatch.name, phone }
          };
        } else {
          response = {
            message: `Désolé, je n'ai pas le numéro de téléphone de ${clientMatch.name}.`,
            intent,
            data: { clientName: clientMatch.name }
          };
        }
        break;
      }
      
      default:
        response = {
          message: 'Je ne peux pas traiter cette demande pour le moment.',
          intent: 'ERROR'
        };
    }

    return processResponse(response);
  }
};

// Post-process responses to fill in message templates
export function processResponse(response: VoiceResponse): VoiceResponse {
  if (!response.message && response.intent) {
    response.message = buildResponse(response.intent, response.data);
  }
  return response;
}
