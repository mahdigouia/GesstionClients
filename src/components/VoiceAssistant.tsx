'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { ClientDebt, AnalysisResult } from '@/types/debt';
import { voiceNLP, VoiceResponse } from '@/lib/voiceNLP';

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
  onShowResults?: (results: ClientDebt[], title: string) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  data?: VoiceResponse;
}

export function VoiceAssistant({ debts, analysis, onShowResults }: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [recognitionLang, setRecognitionLang] = useState<'fr-FR' | 'ar-TN'>('fr-FR');
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationStartTime = useRef<Date>(new Date());

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get unique client names for the LLM
  const clientNames = Array.from(new Set(debts.map(d => d.clientName)));

  // Handle voice command
  const handleVoiceCommand = useCallback(async (command: string) => {
    setVoiceState('processing');
    
    // Add user message
    addMessage('user', command);
    
    try {
      // 1. Try to use the LLM API
      const apiResponse = await fetch('/api/voice-nlp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: command, clientNames })
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

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
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
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState('listening');
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        handleVoiceCommand(finalTranscript);
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
      
      addMessage('assistant', errorMessage);
      setVoiceState('idle');
    };

    recognition.onend = () => {
      if (voiceState === 'listening') {
        setVoiceState('idle');
      }
    };

    return recognition;
  }, [recognitionLang, voiceState, handleVoiceCommand]);

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

  // Start listening
  const startListening = () => {
    const recognition = initSpeechRecognition();
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
    window.speechSynthesis.cancel();
    setVoiceState('idle');
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      window.speechSynthesis.cancel();
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

  // Suggested questions
  const suggestedQuestions = [
    'Total des créances',
    'Alertes critiques',
    'Contentieux',
    'Créances en retard',
    'Clients à risque'
  ];

  const handleSuggestedQuestion = (question: string) => {
    handleVoiceCommand(question);
  };

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
                            
                            {/* View Results Button */}
                            {onShowResults && message.data?.data?.invoices && message.data.data.invoices.length > 0 && (
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
