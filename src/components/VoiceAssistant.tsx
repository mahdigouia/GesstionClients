'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  X, 
  MessageCircle,
  Copy,
  CheckCircle2,
  Send,
  ArrowRight,
  Search
} from 'lucide-react';
import { ClientDebt, AnalysisResult } from '@/types/debt';
import { voiceNLP, VoiceResponse } from '@/lib/voiceNLP';
import { QuickClientProfile } from './QuickClientProfile';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip,
  AreaChart,
  Area
} from 'recharts';

const ChartRenderer = ({ data }: { data: { name: string; value: number }[] }) => {
  return (
    <div className="w-full h-48 mt-4 bg-white/50 rounded-xl p-2 border border-blue-100 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#64748b' }}
          />
          <YAxis 
            hide={true}
          />
          <RechartsTooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ fontWeight: 'bold', fontSize: '12px' }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorValue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface VoiceAssistantProps {
  debts: ClientDebt[];
  analysis: AnalysisResult | null;
  userRole?: 'admin' | 'gestionnaire' | 'commercial' | 'pending' | null;
  onShowResults?: (results: ClientDebt[], title: string) => void;
  onClientClick?: (clientName: string) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  data?: VoiceResponse;
}

// ===== INTELLIGENT CLIENT NAME MATCHING =====

/**
 * Transliterate Arabic script names into Latin equivalents for Tunisian names.
 */
function transliterateArabicToLatin(str: string): string {
  const arabicToLatinMap: { [key: string]: string } = {
    'أ': 'a', 'ا': 'a', 'إ': 'a', 'آ': 'a', 'ى': 'a',
    'ب': 'b',
    'ت': 't', 'ة': 't',
    'ث': 'th',
    'ج': 'j',
    'ح': 'h',
    'خ': 'kh',
    'د': 'd',
    'ذ': 'dh',
    'ر': 'r',
    'ز': 'z',
    'س': 's', 'ص': 's',
    'ش': 'ch',
    'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a',
    'غ': 'gh',
    'ف': 'f',
    'ق': 'q',
    'ك': 'k',
    'ل': 'l',
    'م': 'm',
    'ن': 'n',
    'ه': 'h',
    'و': 'ou',
    'ي': 'y',
    'ء': 'a',
    'ئ': 'i',
    'ؤ': 'ou',
  };

  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (arabicToLatinMap[char] !== undefined) {
      result += arabicToLatinMap[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Extract a consonant skeleton of a name to match phonetically regardless of variable vowels.
 */
function getConsonantSkeleton(str: string): string {
  let normalized = transliterateArabicToLatin(str.toLowerCase());
  
  // Keep only letters and remove accents
  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
    
  // Standard replacements
  normalized = normalized
    .replace(/gh/g, 'r')
    .replace(/kh/g, 'r')
    .replace(/ch/g, 's')
    .replace(/sh/g, 's')
    .replace(/ph/g, 'f')
    .replace(/g/g, 'r')
    .replace(/k/g, 'q')
    .replace(/c/g, 'q')
    .replace(/j/g, 'z')
    .replace(/x/g, 's');
    
  // Remove vowels
  const consonantsOnly = normalized.replace(/[aeiouwy]/g, '');
  
  // Simplify doubles
  return consonantsOnly.replace(/([a-z])\1+/g, '$1');
}

/**
 * Normalize a string for fuzzy matching:
 * - Convert Arabic script to Latin
 * - Lowercase
 * - Remove accents
 * - Collapse multiple spaces
 * - Handle abbreviations (STE -> SOCIETE, ETS -> ETABLISSEMENT, etc.)
 */
function normalizeForMatching(str: string): string {
  const transliterated = transliterateArabicToLatin(str);
  
  return transliterated
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ')    // Replace special chars with spaces
    .replace(/\s+/g, ' ')            // Collapse spaces
    .trim();
}

/**
 * Remove all spaces/separators to create a "collapsed" version for letter-by-letter matching
 * e.g., "SO MO CO D" -> "somocod", "so mo co d" -> "somocod"
 */
function collapseString(str: string): string {
  return normalizeForMatching(str).replace(/\s/g, '');
}

/**
 * Normalize Tunisian Arabic / French accents and common phonetic transcriptions.
 * Specifically targets the rolled R / Russian-like pronunciation or uvular R
 * which might get transcribed as "g", "gh", "kh", "rr", etc.
 */
function tunisianPhoneticNormalize(str: string): string {
  let res = normalizeForMatching(str);
  
  // Standard replacements for Tunisian french/arabic spellings
  res = res
    .replace(/gh/g, 'r')
    .replace(/kh/g, 'r')
    .replace(/ch/g, 's')
    .replace(/sh/g, 's')
    .replace(/ph/g, 'f')
    .replace(/ou/g, 'o')
    .replace(/w/g, 'o')
    .replace(/y/g, 'i')
    
    // Tunisian pronunciation of R (rolled R like Russian, or uvular R transcribed as g)
    .replace(/g/g, 'r')
    .replace(/k/g, 'q')
    .replace(/c/g, 'q')
    
    // Remove double characters
    .replace(/([a-z])\1+/g, '$1');
    
  return res;
}

/**
 * Generate alternative forms of client names for matching.
 * Handles abbreviations, letter-by-letter names, etc.
 */
function generateAlternatives(clientName: string): string[] {
  const alts: string[] = [
    normalizeForMatching(clientName),
    collapseString(clientName),
  ];

  // Add word-initials version: "SOCIETE SUPER DISTRIBUTION" -> "ssd"
  const words = normalizeForMatching(clientName).split(' ').filter(w => w.length > 0);
  if (words.length > 1) {
    alts.push(words.map(w => w[0]).join(''));
  }

  // Add without common prefixes
  const prefixes = ['societe', 'ste', 'ets', 'etablissement', 'sarl', 'sa', 'srl'];
  for (const prefix of prefixes) {
    const norm = normalizeForMatching(clientName);
    if (norm.startsWith(prefix + ' ')) {
      alts.push(norm.substring(prefix.length + 1).trim());
      alts.push(collapseString(norm.substring(prefix.length + 1)));
    }
  }

  // Add Tunisian phonetic versions
  const phonetic = tunisianPhoneticNormalize(clientName);
  alts.push(phonetic);
  alts.push(phonetic.replace(/\s/g, ''));

  return Array.from(new Set(alts));
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
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
  
  return matrix[b.length][a.length];
}

/**
 * Smart fuzzy match: find the best matching client from speech input.
 */
function findBestClientMatchSmart(
  spokenText: string, 
  clientNames: string[]
): { name: string; score: number } | null {
  if (!spokenText || !spokenText.trim()) return null;
  
  const normalizedInput = normalizeForMatching(spokenText);
  if (!normalizedInput) return null;
  
  const collapsedInput = collapseString(spokenText);
  const phoneticInput = tunisianPhoneticNormalize(spokenText);
  const collapsedPhoneticInput = phoneticInput.replace(/\s/g, '');
  const skeletonInput = getConsonantSkeleton(spokenText);
  
  let bestMatch: { name: string; score: number } | null = null;
  let bestScore = 0;
  
  for (const clientName of clientNames) {
    const alternatives = generateAlternatives(clientName);
    const clientPhonetic = tunisianPhoneticNormalize(clientName);
    const collapsedClientPhonetic = clientPhonetic.replace(/\s/g, '');
    const clientSkeleton = getConsonantSkeleton(clientName);
    
    let maxScore = 0;
    
    // Direct consonant skeleton match (extremely robust for Tunisian pronunciation)
    if (skeletonInput === clientSkeleton && skeletonInput.length >= 3) {
      maxScore = Math.max(maxScore, 0.98);
    } else if (clientSkeleton.includes(skeletonInput) && skeletonInput.length >= 4) {
      maxScore = Math.max(maxScore, 0.88);
    } else if (skeletonInput.includes(clientSkeleton) && clientSkeleton.length >= 4) {
      maxScore = Math.max(maxScore, 0.88);
    }
    
    // Direct phonetic match check
    if (phoneticInput === clientPhonetic || collapsedPhoneticInput === collapsedClientPhonetic) {
      maxScore = Math.max(maxScore, 0.95);
    }
    
    for (const alt of alternatives) {
      // 1. Exact match on normalized form
      if (alt === normalizedInput || alt === collapsedInput) {
        maxScore = Math.max(maxScore, 1.0);
        continue;
      }
      
      // 2. Collapsed form match
      const collapsedAlt = alt.replace(/\s/g, '');
      if (collapsedAlt === collapsedInput) {
        maxScore = Math.max(maxScore, 0.98);
        continue;
      }
      
      // Exact phonetic check on alternative
      const altPhonetic = tunisianPhoneticNormalize(alt);
      const collapsedAltPhonetic = altPhonetic.replace(/\s/g, '');
      if (altPhonetic === phoneticInput || collapsedAltPhonetic === collapsedPhoneticInput) {
        maxScore = Math.max(maxScore, 0.92);
        continue;
      }
      
      // 3. Input contains the alternative or vice versa
      if (normalizedInput.includes(alt) || alt.includes(normalizedInput)) {
        const ratio = Math.min(normalizedInput.length, alt.length) / Math.max(normalizedInput.length, alt.length);
        maxScore = Math.max(maxScore, 0.7 + ratio * 0.2);
        continue;
      }
      
      // 4. Collapsed contains check
      if (collapsedInput.includes(collapsedAlt) || collapsedAlt.includes(collapsedInput)) {
        const ratio = Math.min(collapsedInput.length, collapsedAlt.length) / Math.max(collapsedInput.length, collapsedAlt.length);
        maxScore = Math.max(maxScore, 0.65 + ratio * 0.2);
        continue;
      }
      
      // 5. Word-level matching
      const inputWords = normalizedInput.split(' ').filter(w => w.length > 1);
      const altWords = alt.split(' ').filter(w => w.length > 0);
      if (inputWords.length > 0 && altWords.length > 0) {
        const matchingWords = inputWords.filter(iw => 
          altWords.some(aw => aw.startsWith(iw) || iw.startsWith(aw))
        );
        const wordScore = matchingWords.length / Math.max(inputWords.length, altWords.length);
        if (wordScore > 0.5) {
          maxScore = Math.max(maxScore, 0.5 + wordScore * 0.3);
        }
      }
      
      // 6. Levenshtein similarity on collapsed forms
      const maxLen = Math.max(collapsedInput.length, collapsedAlt.length);
      if (maxLen > 0 && maxLen < 30) {
        const dist = levenshteinDistance(collapsedInput, collapsedAlt);
        const similarity = 1 - dist / maxLen;
        if (similarity > 0.6) {
          maxScore = Math.max(maxScore, similarity * 0.85);
        }
      }

      // 7. Phonetic Levenshtein similarity
      const maxPhoneticLen = Math.max(collapsedPhoneticInput.length, collapsedAltPhonetic.length);
      if (maxPhoneticLen > 0 && maxPhoneticLen < 30) {
        const dist = levenshteinDistance(collapsedPhoneticInput, collapsedAltPhonetic);
        const similarity = 1 - dist / maxPhoneticLen;
        if (similarity > 0.65) {
          maxScore = Math.max(maxScore, similarity * 0.80);
        }
      }
    }
    
    if (maxScore > bestScore) {
      bestScore = maxScore;
      bestMatch = { name: clientName, score: maxScore };
    }
  }
  
  return bestMatch && bestScore >= 0.6 ? bestMatch : null;
}

/**
 * Find top N matching clients (for suggestions when confidence is not high enough)
 */
function findTopClientMatches(
  spokenText: string,
  clientNames: string[],
  topN: number = 3
): { name: string; score: number }[] {
  const results: { name: string; score: number }[] = [];
  if (!spokenText || !spokenText.trim()) return [];
  
  const normalizedInput = normalizeForMatching(spokenText);
  if (!normalizedInput) return [];
  
  const collapsedInput = collapseString(spokenText);
  const phoneticInput = tunisianPhoneticNormalize(spokenText);
  const collapsedPhoneticInput = phoneticInput.replace(/\s/g, '');
  const skeletonInput = getConsonantSkeleton(spokenText);
  
  for (const clientName of clientNames) {
    const alternatives = generateAlternatives(clientName);
    const clientPhonetic = tunisianPhoneticNormalize(clientName);
    const collapsedClientPhonetic = clientPhonetic.replace(/\s/g, '');
    const clientSkeleton = getConsonantSkeleton(clientName);
    let maxScore = 0;
    
    // Direct consonant skeleton match
    if (skeletonInput === clientSkeleton && skeletonInput.length >= 3) {
      maxScore = Math.max(maxScore, 0.96);
    } else if (clientSkeleton.includes(skeletonInput) && skeletonInput.length >= 3) {
      maxScore = Math.max(maxScore, 0.85);
    }
    
    if (phoneticInput === clientPhonetic || collapsedPhoneticInput === collapsedClientPhonetic) {
      maxScore = Math.max(maxScore, 0.90);
    }
    
    for (const alt of alternatives) {
      const collapsedAlt = alt.replace(/\s/g, '');
      const altPhonetic = tunisianPhoneticNormalize(alt);
      const collapsedAltPhonetic = altPhonetic.replace(/\s/g, '');
      
      // Same scoring as findBestClientMatchSmart but collect all
      if (alt === normalizedInput || collapsedAlt === collapsedInput) {
        maxScore = Math.max(maxScore, 1.0);
      } else if (altPhonetic === phoneticInput || collapsedAltPhonetic === collapsedPhoneticInput) {
        maxScore = Math.max(maxScore, 0.88);
      } else if (normalizedInput.includes(alt) || alt.includes(normalizedInput)) {
        const ratio = Math.min(normalizedInput.length, alt.length) / Math.max(normalizedInput.length, alt.length);
        maxScore = Math.max(maxScore, 0.7 + ratio * 0.2);
      } else if (collapsedInput.includes(collapsedAlt) || collapsedAlt.includes(collapsedInput)) {
        const ratio = Math.min(collapsedInput.length, collapsedAlt.length) / Math.max(collapsedInput.length, collapsedAlt.length);
        maxScore = Math.max(maxScore, 0.65 + ratio * 0.2);
      } else {
        const maxLen = Math.max(collapsedInput.length, collapsedAlt.length);
        if (maxLen > 0 && maxLen < 30) {
          const dist = levenshteinDistance(collapsedInput, collapsedAlt);
          const similarity = 1 - dist / maxLen;
          if (similarity > 0.4) {
            maxScore = Math.max(maxScore, similarity * 0.85);
          }
        }
        
        const maxPhoneticLen = Math.max(collapsedPhoneticInput.length, collapsedAltPhonetic.length);
        if (maxPhoneticLen > 0 && maxPhoneticLen < 30) {
          const dist = levenshteinDistance(collapsedPhoneticInput, collapsedAltPhonetic);
          const similarity = 1 - dist / maxPhoneticLen;
          if (similarity > 0.45) {
            maxScore = Math.max(maxScore, similarity * 0.78);
          }
        }
      }
    }
    
    if (maxScore > 0.3) {
      results.push({ name: clientName, score: maxScore });
    }
  }
  
  return results.sort((a, b) => b.score - a.score).slice(0, topN);
}


// ===== MAIN COMPONENT =====

export function VoiceAssistant({ debts, analysis, userRole, onShowResults, onClientClick }: VoiceAssistantProps) {
  const isCommercial = userRole === 'commercial' || userRole === 'admin' || userRole === 'gestionnaire';
  
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [recognitionLang, setRecognitionLang] = useState<'fr-FR' | 'ar-TN'>('fr-FR');
  
  // Commercial-specific state
  const [isDirectListening, setIsDirectListening] = useState(false);
  const [matchedClient, setMatchedClient] = useState<string | null>(null);
  const [matchSuggestions, setMatchSuggestions] = useState<{ name: string; score: number }[]>([]);
  const [listeningFeedback, setListeningFeedback] = useState<string>('');
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationStartTime = useRef<Date>(new Date());

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get unique client names for matching
  const clientNames = useMemo(() => 
    Array.from(new Set(debts.map(d => d.clientName))),
    [debts]
  );

  // Get client debts for the matched client
  const matchedClientDebts = useMemo(() => {
    if (!matchedClient) return [];
    return debts.filter(d => d.clientName === matchedClient);
  }, [matchedClient, debts]);

  // Handle voice command (non-commercial mode - existing behavior)
  const handleVoiceCommand = useCallback(async (command: string) => {
    setVoiceState('processing');
    
    // Add user message
    addMessage('user', command);
    
    // Pre-process history to give context to the LLM
    const history = messages.slice(-5).map(m => ({
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    try {
      // 1. Try to use the LLM API
      const apiResponse = await fetch('/api/voice-nlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: command, 
          clientNames,
          history 
        })
      });

      const data = await apiResponse.json();

      let response: VoiceResponse;

      if (apiResponse.ok && !data.useFallback) {
        // LLM Success
        const intent = data.intent || 'UNKNOWN';
        const clientEntity = data.entities?.client;
        response = voiceNLP.executeIntent(intent, clientEntity, debts, analysis);
      } else {
        // API Error or Key missing -> Fallback to Regex
        console.warn('Fallback to local NLP:', data.error);
        response = voiceNLP.processCommand(command, debts, analysis);
      }

      // Add assistant message with delay for natural feel
      setTimeout(() => {
        addMessage('assistant', response.message, response);
        
        // Speak response if not muted
        if (!isMuted) {
          speak(response.message);
        }
        
        setVoiceState('idle');
      }, 500);

    } catch (error) {
      console.error('Error calling voice NLP API:', error);
      // Hard fallback
      const response = voiceNLP.processCommand(command, debts, analysis);
      addMessage('assistant', response.message, response);
      if (!isMuted) speak(response.message);
      setVoiceState('idle');
    }
  }, [debts, analysis, isMuted, clientNames]);

  // Handle commercial direct client search from voice
  const handleCommercialVoiceSearch = useCallback((spokenText: string) => {
    setVoiceState('processing');
    setListeningFeedback(`Recherche: "${spokenText}"...`);
    
    // Try all alternatives from speech recognition
    const bestMatch = findBestClientMatchSmart(spokenText, clientNames);
    
    if (bestMatch && bestMatch.score >= 0.7) {
      // High confidence match - show client directly
      setMatchedClient(bestMatch.name);
      setMatchSuggestions([]);
      setListeningFeedback(`✅ Client trouvé: ${bestMatch.name}`);
      setVoiceState('idle');
      
      // Auto-close listening overlay after a short delay
      setTimeout(() => {
        setIsDirectListening(false);
      }, 500);
    } else {
      // Low confidence - show suggestions
      const suggestions = findTopClientMatches(spokenText, clientNames, 5);
      if (suggestions.length > 0) {
        setMatchSuggestions(suggestions);
        setListeningFeedback(`🔍 Suggestions pour "${spokenText}"`);
      } else {
        setListeningFeedback(`❌ Aucun client trouvé pour "${spokenText}"`);
      }
      setVoiceState('idle');
    }
  }, [clientNames]);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback((isCommercialDirect: boolean = false) => {
    if (typeof window === 'undefined') return null;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = recognitionLang;
    // Use multiple alternatives for better matching
    recognition.maxAlternatives = isCommercialDirect ? 5 : 1;

    recognition.onstart = () => {
      setVoiceState('listening');
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        
        if (result.isFinal) {
          // For commercial mode: try ALL alternatives against client list
          if (isCommercialDirect) {
            let matched = false;
            
            // Try each alternative transcript
            for (let altIndex = 0; altIndex < result.length; altIndex++) {
              const altTranscript = result[altIndex].transcript;
              const match = findBestClientMatchSmart(altTranscript, clientNames);
              if (match && match.score >= 0.7) {
                finalTranscript = altTranscript;
                matched = true;
                break;
              }
            }
            
            // If no high-confidence match from alternatives, use best transcript
            if (!matched) {
              finalTranscript = result[0].transcript;
            }
          } else {
            finalTranscript = result[0].transcript;
          }
        } else {
          interimTranscript = result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        if (isCommercialDirect) {
          handleCommercialVoiceSearch(finalTranscript);
        } else {
          handleVoiceCommand(finalTranscript);
        }
      } else {
        setTranscript(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setVoiceState('error');
      
      let errorMessage = 'Erreur de reconnaissance vocale';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'Je n\'ai pas entendu de parole. Veuillez réessayer.';
          break;
        case 'audio-capture':
          errorMessage = 'Problème avec le microphone. Vérifiez vos permissions.';
          break;
        case 'not-allowed':
          errorMessage = 'Accès au microphone refusé. Veuillez autoriser l\'accès.';
          break;
        case 'network':
          errorMessage = 'Problème de connexion réseau.';
          break;
      }
      
      if (isCommercialDirect) {
        setListeningFeedback(`❌ ${errorMessage}`);
      } else {
        addMessage('assistant', errorMessage);
      }
      setVoiceState('idle');
    };

    recognition.onend = () => {
      if (voiceState === 'listening') {
        setVoiceState('idle');
      }
    };

    return recognition;
  }, [recognitionLang, voiceState, handleVoiceCommand, handleCommercialVoiceSearch, clientNames]);

  // Handle text input submission
  const handleTextSubmit = () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    setTextInput('');
    handleVoiceCommand(trimmed);
  };

  // Handle Enter key in text input
  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  // Add message to conversation
  const addMessage = (type: 'user' | 'assistant', text: string, data?: VoiceResponse) => {
    const newMessage: ConversationMessage = {
      id: Date.now().toString() + Math.random(),
      type,
      text,
      timestamp: new Date(),
      data
    };
    setMessages(prev => [...prev, newMessage]);
  };

  // Text to speech
  const speak = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    
    // Find French voice
    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(v => v.lang.startsWith('fr'));
    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }
    
    utterance.onstart = () => setVoiceState('speaking');
    utterance.onend = () => setVoiceState('idle');
    
    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Start listening (commercial direct mode)
  const startDirectListening = () => {
    setIsDirectListening(true);
    setMatchedClient(null);
    setMatchSuggestions([]);
    setListeningFeedback('🎤 Dites le nom du client...');
    setTranscript('');
    
    const recognition = initSpeechRecognition(true);
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        setListeningFeedback('❌ La reconnaissance vocale n\'est pas supportée.');
      }
    } else {
      setListeningFeedback('❌ La reconnaissance vocale n\'est pas supportée.');
    }
  };

  // Start listening (normal mode)
  const startListening = () => {
    const recognition = initSpeechRecognition(false);
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    } else {
      addMessage('assistant', 'La reconnaissance vocale n\'est pas supportée. Utilisez le champ texte ci-dessous pour poser vos questions.');
    }
  };

  // Stop listening
  const stopListening = () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setVoiceState('idle');
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      window.speechSynthesis?.cancel();
    }
  };

  // Copy message to clipboard
  const copyMessage = (message: ConversationMessage) => {
    navigator.clipboard.writeText(message.text);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Clear conversation
  const clearConversation = () => {
    setMessages([]);
    conversationStartTime.current = new Date();
  };

  // Handle commercial FAB click: directly start listening
  const handleCommercialFabClick = () => {
    if (isDirectListening) {
      // Already listening - stop
      stopListening();
      setIsDirectListening(false);
    } else {
      startDirectListening();
    }
  };

  // Handle suggestion click
  const handleSuggestionSelect = (clientName: string) => {
    setMatchedClient(clientName);
    setMatchSuggestions([]);
    setIsDirectListening(false);
    setListeningFeedback('');
  };

  // Suggested questions based on language
  const suggestedQuestions = recognitionLang === 'fr-FR' ? [
    'Total des créances',
    'Alertes critiques',
    'Retenues à la source',
    'Créances en retard',
    'Clients à risque'
  ] : [
    '9adech ysalouni lkol',
    'أعطيني الفاتورات إلي مش خالصة',
    'chnouma l-retenues elli mazalou',
    'chfama alertes tawwa',
    'aatini numero mta3 client'
  ];

  const handleSuggestedQuestion = (question: string) => {
    handleVoiceCommand(question);
  };

  // ===== RENDER =====

  // Commercial mode: Direct search FAB + Listening overlay + Client popup
  if (isCommercial) {
    return (
      <>
        {/* Large Floating Action Button for Commercial */}
        <button
          onClick={handleCommercialFabClick}
          className={`
            fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50
            w-20 h-20 md:w-24 md:h-24 rounded-full
            flex flex-col items-center justify-center gap-1
            shadow-2xl hover:shadow-3xl
            transition-all duration-300 transform
            ${isDirectListening || voiceState === 'listening'
              ? 'bg-gradient-to-br from-red-500 to-rose-600 scale-110 ring-4 ring-red-300/50 animate-pulse' 
              : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 hover:scale-105'
            }
            text-white
          `}
          aria-label="Rechercher un client par la voix"
        >
          {isDirectListening || voiceState === 'listening' ? (
            <>
              <MicOff className="h-8 w-8 md:h-9 md:w-9" />
              <span className="text-[9px] md:text-[10px] font-bold leading-tight">Arrêter</span>
            </>
          ) : (
            <>
              <Mic className="h-8 w-8 md:h-9 md:w-9" />
              <span className="text-[9px] md:text-[10px] font-bold leading-tight text-center">Chercher{'\n'}Client</span>
            </>
          )}
        </button>

        {/* Listening Overlay (replaces the full modal) */}
        {isDirectListening && (
          <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-28 md:pb-32 pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto">
              <Card className="border-2 border-blue-200 shadow-2xl bg-white/95 backdrop-blur-xl animate-in slide-in-from-bottom-4 duration-300">
                <CardContent className="p-4 space-y-3">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-full ${
                        voiceState === 'listening' ? 'bg-red-100 text-red-600 animate-pulse' :
                        voiceState === 'processing' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {voiceState === 'listening' ? <Mic className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Recherche Client Vocale</p>
                        <p className="text-xs text-slate-500">{listeningFeedback}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        stopListening();
                        setIsDirectListening(false);
                      }}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Live transcript */}
                  {voiceState === 'listening' && transcript && (
                    <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-800 font-medium animate-pulse">
                      🎤 {transcript}
                    </div>
                  )}

                  {/* Suggestions list */}
                  {matchSuggestions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vouliez-vous dire :</p>
                      {matchSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionSelect(s.name)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 transition-all text-left group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                              {s.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-800 group-hover:text-blue-700 text-sm">{s.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600">
                            {Math.round(s.score * 100)}%
                          </Badge>
                        </button>
                      ))}
                      
                      {/* Retry button */}
                      <Button
                        onClick={() => {
                          setMatchSuggestions([]);
                          startDirectListening();
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full mt-2 gap-2"
                      >
                        <Mic className="h-4 w-4" />
                        Réessayer
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Client Profile Popup */}
        {matchedClient && matchedClientDebts.length > 0 && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
              <QuickClientProfile 
                clientName={matchedClient}
                debts={matchedClientDebts}
                onClose={() => {
                  setMatchedClient(null);
                  setListeningFeedback('');
                }}
                onClientClick={(name) => {
                  setMatchedClient(null);
                  setListeningFeedback('');
                  if (onClientClick) {
                    onClientClick(name);
                  }
                }}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // ===== Non-commercial mode: Existing chat-based assistant =====
  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50
          w-14 h-14 rounded-full
          bg-gradient-to-br from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700
          text-white shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all duration-300
          ${voiceState === 'listening' ? 'animate-pulse scale-110 ring-4 ring-red-300' : ''}
          ${voiceState === 'speaking' ? 'bg-gradient-to-br from-green-500 to-emerald-600 ring-4 ring-green-300' : ''}
        `}
        aria-label="Ouvrir l'assistant vocal"
      >
        <Mic className="h-6 w-6" />
      </button>

      {/* Voice Assistant Modal - Full screen on mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/50">
          <Card className="w-full md:max-w-lg h-[100dvh] md:h-auto md:max-h-[80vh] flex flex-col rounded-none md:rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className={`
                  p-2 rounded-full
                  ${voiceState === 'listening' ? 'bg-red-100 text-red-600 animate-pulse' : ''}
                  ${voiceState === 'speaking' ? 'bg-green-100 text-green-600' : ''}
                  ${voiceState === 'processing' ? 'bg-yellow-100 text-yellow-600' : ''}
                  ${voiceState === 'idle' ? 'bg-blue-100 text-blue-600' : ''}
                  ${voiceState === 'error' ? 'bg-gray-100 text-gray-600' : ''}
                `}>
                  {voiceState === 'listening' && <Mic className="h-5 w-5" />}
                  {voiceState === 'speaking' && <Volume2 className="h-5 w-5" />}
                  {voiceState === 'processing' && <MessageCircle className="h-5 w-5 animate-spin" />}
                  {voiceState === 'idle' && <Mic className="h-5 w-5" />}
                  {voiceState === 'error' && <MicOff className="h-5 w-5" />}
                </div>
                <div>
                  <CardTitle className="text-lg">Assistant Vocal</CardTitle>
                  <p className="text-xs text-gray-500">
                    {voiceState === 'idle' && 'Prêt à écouter'}
                    {voiceState === 'listening' && 'Écoute en cours...'}
                    {voiceState === 'processing' && 'Traitement...'}
                    {voiceState === 'speaking' && 'Lecture en cours...'}
                    {voiceState === 'error' && 'Erreur'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRecognitionLang(recognitionLang === 'fr-FR' ? 'ar-TN' : 'fr-FR')}
                  className="h-8 px-2 text-xs font-medium gap-1"
                >
                  {recognitionLang === 'fr-FR' ? (
                    <><span>🇫🇷</span> FR</>
                  ) : (
                    <><span>🇹🇳</span> TN</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-8 w-8"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <Mic className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">
                      Posez-moi des questions sur vos créances
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {suggestedQuestions.map((q, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="cursor-pointer hover:bg-blue-50 text-xs md:text-sm"
                          onClick={() => handleSuggestedQuestion(q)}
                        >
                          {q}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`
                          max-w-[85%] rounded-lg p-3
                          ${message.type === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                          }
                        `}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                        {message.type === 'assistant' && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => speak(message.text)}
                              className="h-6 px-2 text-xs"
                            >
                              <Volume2 className="h-3 w-3 mr-1" />
                              Écouter
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyMessage(message)}
                              className="h-6 px-2 text-xs"
                            >
                              {copiedId === message.id ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1" /> Copié</>
                              ) : (
                                <><Copy className="h-3 w-3 mr-1" /> Copier</>
                              )}
                            </Button>
                          </div>
                        )}
                        {message.data && (
                          <div className="mt-3 space-y-2">
                            {message.data.data?.chartData && (
                              <ChartRenderer data={message.data.data.chartData} />
                            )}
                            
                            {onShowResults && message.data.data?.invoices && message.data.data.invoices.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onShowResults(message.data.data.invoices || [], message.data.data.clientName || 'Résultats')}
                                className="h-6 px-2 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                              >
                                <ArrowRight className="h-3 w-3 mr-1" />
                                Voir les détails
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t p-3 md:p-4 bg-gray-50 flex-shrink-0">
                {/* Live transcript when listening */}
                {voiceState === 'listening' && transcript && (
                  <div className="mb-3 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                    🎤 {transcript}
                  </div>
                )}

                {/* Text input for typing questions */}
                <div className="flex items-center gap-2 mb-3">
                  <Input
                    placeholder="Tapez votre question..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleTextKeyDown}
                    className="flex-1 h-10"
                  />
                  <Button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim() || voiceState === 'processing'}
                    size="icon"
                    className="h-10 w-10 bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={voiceState === 'listening' ? stopListening : startListening}
                    className={`
                      flex-1 gap-2
                      ${voiceState === 'listening' 
                        ? 'bg-red-600 hover:bg-red-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                      }
                    `}
                  >
                    {voiceState === 'listening' ? (
                      <><MicOff className="h-4 w-4" /> Arrêter</>
                    ) : (
                      <><Mic className="h-4 w-4" /> Parler</>
                    )}
                  </Button>
                  
                  {messages.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={clearConversation}
                      className="px-3"
                    >
                      Effacer
                    </Button>
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-2 text-center">
                  Parlez ou tapez votre question en français
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

// TypeScript declarations for Web Speech API constructor
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}
