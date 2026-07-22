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
    'ت': 't', 'ة': 'h',
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

// ===== SELF-LEARNING ENGINE =====
// Stores user-confirmed corrections: { normalizedSpokenText -> correctClientName }
const LEARNING_STORAGE_KEY = 'gc_voice_corrections';

function getLearningMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LEARNING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLearningCorrection(spokenText: string, correctClientName: string): void {
  try {
    const map = getLearningMap();
    map[normalizeForMatching(spokenText)] = correctClientName;
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

function checkLearningMap(spokenText: string, clientNames: string[]): string | null {
  try {
    const map = getLearningMap();
    const normalizedInput = normalizeForMatching(spokenText);
    const learned = map[normalizedInput];
    if (learned && clientNames.includes(learned)) return learned;
    // Fuzzy check on learned keys
    for (const [learnedInput, clientName] of Object.entries(map)) {
      if (!clientNames.includes(clientName)) continue;
      const maxLen = Math.max(normalizedInput.length, learnedInput.length);
      if (maxLen > 0 && (1 - levenshteinDistance(normalizedInput, learnedInput) / maxLen) >= 0.92) {
        return clientName;
      }
    }
    return null;
  } catch { return null; }
}

// Export so UI can record user corrections
export function recordVoiceCorrection(spokenText: string, correctClientName: string): void {
  saveLearningCorrection(spokenText, correctClientName);
}

// ===== STOP WORDS =====
const STOP_WORDS_SET = new Set([
  'societe', 'ste', 'sarl', 'suarl', 'sarlu', 'sa', 'srl', 'snc', 'spa', 'eurl', 'sas',
  'etablissement', 'ets', 'enterprise', 'entreprise',
  'distribution', 'commerce', 'commercial', 'import', 'export', 'service', 'services',
  'general', 'generale', 'internationale', 'national', 'nationale',
  'industrie', 'industries', 'industrielle', 'alimentaire', 'alimentaires',
  'trading', 'group', 'groupe', 'freres', 'fils', 'et',
  'emballage', 'emballages', 'packaging', 'pack', 'conditionnement',
  'fourniture', 'fournitures', 'materiel', 'quincaillerie', 'plastique', 'plast',
  'batiment', 'travaux', 'negoce', 'negorce', 'technique', 'techniques',
  'de', 'du', 'des', 'le', 'la', 'les', 'en', 'au', 'aux',
]);
// These connecting words ARE kept even though short, as they're part of Tunisian names
const KEEP_WORDS_SET = new Set(['ben', 'bel', 'bou', 'el', 'al']);

function isStopWord(word: string): boolean {
  return STOP_WORDS_SET.has(word) && !KEEP_WORDS_SET.has(word);
}

// ===== PHONETIC NORMALIZATION ENGINE =====
/**
 * Canonical phoneme replacements for Tunisian Arabic / French names.
 * Maps multiple romanizations of the same Arabic phoneme to one form.
 *
 * Key Arabic letter mappings:
 *   ح (ha)   → h
 *   غ (ghain)→ g  (gh/g/r in Tunisian)
 *   خ (kha)  → k  (kh/k)
 *   ع (ain)  → a  (silent or vowel)
 *   ق (qaf)  → k  (q/k/g in Tunisian)
 *   و (waw)  → u  (ou/w/o)
 *   ش (shin) → s  (ch/sh)
 *   ص (sad)  → s
 *   ث (tha)  → t  (th)
 *   ذ (dhal) → d  (dh)
 */
const PHONEME_RULES: [RegExp, string][] = [
  // Multi-char first
  [/gh/g, 'g'],
  [/kh/g, 'k'],
  [/ch/g, 's'],
  [/sh/g, 's'],
  [/ph/g, 'f'],
  [/th/g, 't'],
  [/dh/g, 'd'],
  [/aa/g, 'a'],
  [/ee/g, 'i'],
  [/ou/g, 'u'],
  [/oo/g, 'u'],
  // Single chars
  [/[wv]/g, 'u'],
  [/[qkg]/g, 'k'],
  [/[sz]/g, 's'],
  [/x/g, 's'],
  [/j/g, 'z'],
  [/y/g, 'i'],
  // Vowel normalization (collapse all vowel variants)
  [/[aàâä]/g, 'a'],
  [/[eéèêë]/g, 'a'],
  [/[iïî]/g, 'i'],
  [/[oôö]/g, 'u'],
  [/[uùûü]/g, 'u'],
  // Deduplicate
  [/(..)\1+/g, '$1'],
  [/(.)(\1)+/g, '$1'],
];

function applyPhonemeRules(str: string): string {
  let res = str;
  for (const [pat, rep] of PHONEME_RULES) res = res.replace(pat, rep);
  return res;
}

/**
 * Normalize a string for matching.
 */
function normalizeForMatching(str: string): string {
  const transliterated = transliterateArabicToLatin(str);
  return transliterated
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Full canonical phonetic form — used for cross-romanization matching.
 */
function toCanonicalPhonetic(str: string): string {
  let res = normalizeForMatching(str);
  res = applyPhonemeRules(res);
  return res.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Consonant skeleton — vowel-stripped form for robust phonetic matching.
 */
function getConsonantSkeleton(str: string): string {
  return toCanonicalPhonetic(str)
    .replace(/[aeiou\s]/g, '')
    .replace(/(.)(\1)+/g, '$1');
}

function collapseString(str: string): string {
  return normalizeForMatching(str).replace(/\s/g, '');
}

/**
 * Extract significant tokens (remove stop words, min length 2).
 * Sorted by length desc — longer = more distinctive.
 */
function extractSignificantTokens(name: string): string[] {
  const tokens = normalizeForMatching(name).split(' ').filter(t => t.length >= 2);
  const sig = tokens.filter(t => !isStopWord(t));
  const result = sig.length > 0 ? sig : tokens;
  return result.sort((a, b) => b.length - a.length);
}

/** N-gram set */
function getNgrams(str: string, n: number = 3): Set<string> {
  const s = str.replace(/\s/g, '_');
  const grams = new Set<string>();
  for (let i = 0; i <= s.length - n; i++) grams.add(s.substring(i, i + n));
  return grams;
}

/** Dice coefficient between two n-gram sets */
function ngramSimilarity(a: string, b: string, n: number = 3): number {
  if (a.length < n && b.length < n) {
    return a === b ? 1 : (a.includes(b) || b.includes(a) ? 0.7 : 0);
  }
  const ag = getNgrams(a, n);
  const bg = getNgrams(b, n);
  if (ag.size === 0 || bg.size === 0) return 0;
  let inter = 0;
  for (const g of ag) if (bg.has(g)) inter++;
  return (2 * inter) / (ag.size + bg.size);
}

/**
 * Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i-1] === a[j-1]
        ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
    }
  }
  return matrix[b.length][a.length];
}

function levenshteinSim(a: string, b: string): number {
  const ml = Math.max(a.length, b.length);
  return ml === 0 ? 1 : 1 - levenshteinDistance(a, b) / ml;
}

/**
 * Token-level matching score (ORDER INDEPENDENT).
 * Each query token is matched against all client tokens using phonetics.
 * Weight = sqrt(token length) → longer tokens are more distinctive.
 */
function tokenMatchScore(queryTokens: string[], clientTokens: string[]): number {
  if (!queryTokens.length || !clientTokens.length) return 0;

  const cPhonetic = clientTokens.map(t => toCanonicalPhonetic(t));
  const cSkeleton = clientTokens.map(t => getConsonantSkeleton(t));

  let totalWeight = 0, matchedWeight = 0;

  for (const qTok of queryTokens) {
    const w = Math.sqrt(qTok.length);
    totalWeight += w;
    const qPh = toCanonicalPhonetic(qTok);
    const qSk = getConsonantSkeleton(qTok);
    let best = 0;

    for (let i = 0; i < clientTokens.length; i++) {
      const cTok = clientTokens[i];
      let sc = 0;
      if (qTok === cTok)                                              sc = 1.0;
      else if (qPh === cPhonetic[i] && qPh.length >= 2)              sc = 0.97;
      else if (qSk === cSkeleton[i] && qSk.length >= 2)              sc = 0.94;
      else if (cTok.startsWith(qTok) && qTok.length >= 4)            sc = 0.85 + (qTok.length / cTok.length) * 0.1;
      else if (qTok.startsWith(cTok) && cTok.length >= 4)            sc = 0.80 + (cTok.length / qTok.length) * 0.1;
      else if (cPhonetic[i].startsWith(qPh) && qPh.length >= 3)     sc = 0.82;
      else if (qPh.startsWith(cPhonetic[i]) && cPhonetic[i].length >= 3) sc = 0.78;
      else if (cSkeleton[i].includes(qSk) && qSk.length >= 3)       sc = 0.75;
      else {
        const ng = ngramSimilarity(qPh, cPhonetic[i], Math.min(3, Math.min(qPh.length, cPhonetic[i].length)));
        if (ng > 0.4) sc = ng * 0.88;
      }
      if (sc < 0.6 && qPh.length >= 3) {
        const lev = levenshteinSim(qPh, cPhonetic[i]);
        if (lev > 0.65) sc = Math.max(sc, lev * 0.82);
      }
      if (sc > best) best = sc;
    }
    matchedWeight += w * best;
  }
  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

/** Generate alternative client name forms (without legal prefixes) */
function generateAlternatives(clientName: string): string[] {
  const alts: string[] = [normalizeForMatching(clientName)];
  const norm = normalizeForMatching(clientName);
  for (const pfx of ['societe', 'ste', 'ets', 'etablissement', 'sarl', 'sa', 'srl', 'snc']) {
    if (norm.startsWith(pfx + ' ')) alts.push(norm.substring(pfx.length + 1).trim());
  }
  return Array.from(new Set(alts));
}

/**
 * Compute final match score between spoken text and a client name.
 * Combines 8 strategies: exact, phonetic, skeleton, token, containment, ngram, alternatives.
 */
function computeMatchScore(spokenText: string, clientName: string): number {
  const normInput = normalizeForMatching(spokenText);
  const normClient = normalizeForMatching(clientName);
  if (!normInput || !normClient) return 0;

  const phInput  = toCanonicalPhonetic(spokenText);
  const phClient = toCanonicalPhonetic(clientName);
  const skInput  = getConsonantSkeleton(spokenText);
  const skClient = getConsonantSkeleton(clientName);
  const colInput  = collapseString(spokenText);
  const colClient = collapseString(clientName);

  let best = 0;

  // S1: Exact
  if (normInput === normClient) return 1.0;
  // S2: Phonetic exact
  if (phInput === phClient && phInput.length >= 3) best = Math.max(best, 0.98);
  // S3: Skeleton exact
  if (skInput === skClient && skInput.length >= 3) best = Math.max(best, 0.96);

  // S4: Token matching (ORDER INDEPENDENT)
  const qTokens = extractSignificantTokens(spokenText);
  const cTokens = normClient.split(' ').filter(t => t.length >= 2);
  if (qTokens.length > 0 && cTokens.length > 0) {
    const tokScore = tokenMatchScore(qTokens, cTokens);
    const coverage = qTokens.length / Math.max(qTokens.length, cTokens.length);
    best = Math.max(best, tokScore * (0.7 + coverage * 0.3));
    // Single distinctive token bonus
    if (qTokens.length === 1 && tokScore >= 0.88) best = Math.max(best, tokScore * 0.98);
  }

  // S5: Containment on collapsed strings
  if (colClient.includes(colInput) && colInput.length >= 4)
    best = Math.max(best, 0.65 + (colInput.length / colClient.length) * 0.25);
  if (colInput.includes(colClient) && colClient.length >= 4)
    best = Math.max(best, 0.65 + (colClient.length / colInput.length) * 0.25);

  // S6: Skeleton containment
  if (skClient.includes(skInput) && skInput.length >= 4) best = Math.max(best, 0.82);

  // S7: N-gram on collapsed phonetic forms
  const phColInput  = phInput.replace(/\s/g, '');
  const phColClient = phClient.replace(/\s/g, '');
  if (phColInput.length >= 4 && phColClient.length >= 4)
    best = Math.max(best, ngramSimilarity(phColInput, phColClient, 3) * 0.88);

  // S8: Alternatives (strip legal prefix)
  for (const alt of generateAlternatives(clientName)) {
    if (alt === normInput) { best = 1.0; break; }
    const altPh = toCanonicalPhonetic(alt);
    if (altPh === phInput && altPh.length >= 3) { best = Math.max(best, 0.96); break; }
    const altTokens = alt.split(' ').filter(t => t.length >= 2);
    if (altTokens.length > 0 && qTokens.length > 0)
      best = Math.max(best, tokenMatchScore(qTokens, altTokens) * 0.95);
  }

  return best;
}

/**
 * Find best matching client. Checks self-learning first.
 */
function findBestClientMatchSmart(
  spokenText: string,
  clientNames: string[]
): { name: string; score: number } | null {
  if (!spokenText?.trim()) return null;

  const learned = checkLearningMap(spokenText, clientNames);
  if (learned) return { name: learned, score: 1.0 };

  let bestMatch: { name: string; score: number } | null = null;
  let bestScore = 0;

  for (const name of clientNames) {
    const score = computeMatchScore(spokenText, name);
    if (score > bestScore) { bestScore = score; bestMatch = { name, score }; }
  }

  // Threshold 0.55 — more permissive to catch partial names ("missaoui")
  return bestMatch && bestScore >= 0.55 ? bestMatch : null;
}

/**
 * Find top N matching clients for suggestions.
 */
function findTopClientMatches(
  spokenText: string,
  clientNames: string[],
  topN: number = 5
): { name: string; score: number }[] {
  if (!spokenText?.trim()) return [];

  const learned = checkLearningMap(spokenText, clientNames);
  if (learned) return [{ name: learned, score: 1.0 }];

  return clientNames
    .map(name => ({ name, score: computeMatchScore(spokenText, name) }))
    .filter(r => r.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
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
    
    if (bestMatch && bestMatch.score >= 0.88) {
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
              if (match && match.score >= 0.88) {
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

  // Handle suggestion click & learn correction
  const handleSuggestionSelect = (clientName: string) => {
    if (transcript.trim()) {
      recordVoiceCorrection(transcript, clientName);
    }
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
                                onClick={() => onShowResults(message.data?.data?.invoices || [], message.data?.data?.clientName || 'Résultats')}
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
