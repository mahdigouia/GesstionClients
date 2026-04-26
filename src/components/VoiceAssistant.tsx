'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  X, 
  MessageCircle,
  Copy,
  CheckCircle2
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
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  data?: VoiceResponse;
}

export function VoiceAssistant({ debts, analysis }: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationStartTime = useRef<Date>(new Date());

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    recognition.lang = 'fr-FR';
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
  }, []);

  // Handle voice command
  const handleVoiceCommand = useCallback((command: string) => {
    setVoiceState('processing');
    
    // Add user message
    addMessage('user', command);
    
    // Process command
    const response = voiceNLP.processCommand(command, debts, analysis);
    
    // Add assistant message with delay for natural feel
    setTimeout(() => {
      addMessage('assistant', response.message, response);
      
      // Speak response if not muted
      if (!isMuted) {
        speak(response.message);
      }
      
      setVoiceState('idle');
    }, 500);
  }, [debts, analysis, isMuted]);

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
      addMessage('assistant', 'Désolé, la reconnaissance vocale n\'est pas supportée sur votre navigateur. Essayez Chrome ou Safari.');
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
    'Factures non payées de...',
    'Total des créances',
    'Alertes critiques',
    'Contentieux',
    'Créances en retard'
  ];

  const handleSuggestedQuestion = (question: string) => {
    if (question.includes('...')) {
      // For questions requiring input, just start listening
      startListening();
    } else {
      handleVoiceCommand(question);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full
          bg-blue-600 hover:bg-blue-700
          text-white shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all duration-300
          ${voiceState === 'listening' ? 'animate-pulse scale-110' : ''}
          ${voiceState === 'speaking' ? 'bg-green-600' : ''}
        `}
        aria-label="Ouvrir l'assistant vocal"
      >
        <Mic className="h-6 w-6" />
      </button>

      {/* Voice Assistant Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-lg max-h-[80vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
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
                          className="cursor-pointer hover:bg-blue-50"
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
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t p-4 bg-gray-50">
                {/* Live transcript when listening */}
                {voiceState === 'listening' && transcript && (
                  <div className="mb-3 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                    🎤 {transcript}
                  </div>
                )}

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
                  Appuyez sur le bouton et parlez en français
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
