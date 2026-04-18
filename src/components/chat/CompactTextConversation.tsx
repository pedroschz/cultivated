"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { app, auth } from '@/lib/firebaseClient';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import { Bot, Send, X, User as UserIcon, Loader2, RotateCcw } from 'lucide-react';
import { triggerAiLimitPopup } from '@/lib/ai/usageClient';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  options?: string[];
  allowOther?: boolean;
  isToolCall?: boolean;
}

interface CompactTextConversationProps {
  isOpen: boolean;
  question: {
    question: string;
    options: string[] | string;
    answer: number | string;
    passage?: string;
  };
  userAnswer: string | number;
  onClose: () => void;
  className?: string;
  hasSubmittedAnswer?: boolean;
  highlightsCsv?: string;
  tutorName?: string;
  procedureTranscript?: string;
  procedureStatus?: 'ok' | 'warning';
  onSwitchToVoice?: () => void;
}

export function CompactTextConversation({
  isOpen,
  question,
  userAnswer,
  onClose,
  className,
  hasSubmittedAnswer = false,
  highlightsCsv,
  tutorName: preloadedTutorName,
  procedureTranscript,
  procedureStatus,
  onSwitchToVoice
}: CompactTextConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tutorName, setTutorName] = useState<string>(preloadedTutorName || 'AI Tutor');
  const [userName, setUserName] = useState('Student');
  const [userInterests, setUserInterests] = useState<{role: string, text: string}[]>([]);
  const isInitializingRef = useRef(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Resolve user name and tutor name
  useEffect(() => {
    const resolveUserAndTutor = async () => {
      const currentUser = auth?.currentUser;
      if (currentUser && app) {
        try {
          const db = getFirestore(app);
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.name) setUserName(data.name.split(' ')[0]);
            if (!preloadedTutorName && data['tutor-name']) {
              setTutorName(data['tutor-name']);
            }
            if (Array.isArray(data.interests)) {
              setUserInterests(data.interests);
            }
          } else if (currentUser.displayName) {
            setUserName(currentUser.displayName.split(' ')[0]);
          }
        } catch (e) {
          console.warn('Failed to resolve user data', e);
        }
      }
    };
    resolveUserAndTutor();
  }, [preloadedTutorName]);

  const getSystemInstruction = () => {
      // Build System Instruction
      const optionsText = Array.isArray(question.options)
        ? question.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')
        : String(question.options || '');
      
      const userAnswerDisplay = Array.isArray(question.options) && typeof userAnswer === 'number'
        ? String.fromCharCode(65 + (userAnswer as number))
        : String(userAnswer || '');
        
      const correctAnswerDisplay = Array.isArray(question.options) && typeof question.answer === 'number'
        ? String.fromCharCode(65 + (question.answer as number))
        : String(question.answer || '');

      const sectionLine = question.passage ? 'This is a READING AND WRITING question with a passage.' : 'This is a MATH question.';
      const passageText = question.passage ? `\n\nReading Passage:\n${question.passage}` : '';
      
      const highlightedLine = highlightsCsv && String(highlightsCsv).trim().length > 0
        ? `\nHIGHLIGHTED PARTS (user found important): ${highlightsCsv}`
        : '';
        
      const procedureLines = procedureTranscript && String(procedureTranscript).trim().length > 0
        ? `\nSTUDENT'S WRITTEN PROCEDURE:\n${String(procedureTranscript).slice(0, 1400)}`
        : '';

      const interestContext = userInterests.length > 0 
        ? `\n\nSTUDENT INTERESTS (Use this to personalize examples/analogies):\n${userInterests.map(i => `${i.role === 'user' ? 'Student' : 'Tutor'}: ${i.text}`).join('\n')}` 
        : '';

      const baseInstruction = [
        `Your name is ${tutorName}. You are a world-class SAT expert tutor helping ${userName}.`,
        interestContext,
        sectionLine,
        `Question: ${question.question}`,
        passageText,
        'Answer Choices:',
        optionsText,
        `Student's Answer: ${userAnswerDisplay}`,
        highlightedLine,
        procedureLines,
        '',
        'TUTORING APPROACH:',
        'Use the Socratic method. Ask guiding questions. Be concise.',
        'IMPORTANT: To present options to the user, you MUST call the "ask_question" function. DO NOT describe the function call in text. DO NOT say "I will use ask_question". just CALL it.',
        'When you call "ask_question", the user will see buttons. You do not need to list the options in your text response.',
        'If the question is truly open-ended (e.g., asking for an equation or complex thought), then use text.',
        'Do not give away the answer immediately.'
      ];

      if (hasSubmittedAnswer) {
        baseInstruction.push(`Correct Answer: ${correctAnswerDisplay}`);
        baseInstruction.push(`The student got it WRONG. Help them understand their mistake. Start by asking what they thought.`);
      } else {
        baseInstruction.push(`The student has NOT answered yet. Guide them to the solution without revealing it.`);
      }

      return baseInstruction.join('\n');
  };

  // Initialize Chat
  useEffect(() => {
    if (isOpen && !isInitializingRef.current) {
      isInitializingRef.current = true;
      startChatSession();
    }
  }, [isOpen, userName]); // Re-start if username changes significantly, though usually it's fast

  const startChatSession = async () => {
    setIsLoading(true);
    try {
      // Send initial "Start the session" message without adding it to UI (or handle it specially)
      // Actually the original implementation sent it but didn't seem to show it?
      // "session.sendMessage("Start the session.")" returns a response which IS shown.
      // So we call sendMessage with hidden=true or just call the API directly.
      await sendMessage("Start the session.", [], true);
    } catch (e) {
      console.error("Failed to start chat", e);
      setMessages([{ id: 'err', role: 'model', text: "Sorry, I couldn't connect to the AI Tutor." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIResponse = (text: string | undefined, calls: any[]) => {
    if (calls && calls.length > 0) {
      const call = calls[0];
      if (call.name === 'ask_question') {
        const args = call.args as any;
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          text: args.text,
          options: args.options,
          allowOther: args.allow_other,
          isToolCall: true
        }]);
        // We do NOT send function response immediately; we wait for user selection
        return; 
      }
    }

    if (text) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: text
      }]);
    }
  };

  const sendMessage = async (text: string, historyOverride?: Message[], isHidden = false) => {
    if (!text.trim()) return;

    // Add user message if not hidden
    if (!isHidden) {
        const userMsgId = Date.now().toString();
        setMessages(prev => [...prev, { id: userMsgId, role: 'user', text }]);
        setInputText('');
    }
    
    setIsLoading(true);

    try {
      const currentHistory = historyOverride || messages;
      
      // Convert history to API format
      const historyForApi = currentHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.text }] // Simplified for text-only history
      })).filter(m => m.parts[0].text !== "Start the session."); // Filter out the invisible start command if present in history

      const systemInstruction = getSystemInstruction();
      const requestId = Date.now().toString();
      
      console.error(`[CHAT FRONTEND ${requestId}] Preparing request:`, {
        messageLength: text.length,
        historyLength: historyForApi.length,
        hasSystemInstruction: !!systemInstruction,
        systemInstructionType: typeof systemInstruction,
        systemInstructionLength: typeof systemInstruction === 'string' ? systemInstruction.length : 0
      });
      
      console.error(`[CHAT FRONTEND ${requestId}] Using Firebase callable function: chatTutor`);
      const functions = getFunctions(app, 'us-central1');
      const chatTutor = httpsCallable(functions, 'chatTutor');

      const result = await chatTutor({
        message: text,
        history: historyForApi,
        systemInstruction
      });

      const data = result.data as {
        text?: string;
        functionCalls?: Array<{ name: string; args: any }>;
      };

      console.error(`[CHAT FRONTEND ${requestId}] Callable response received:`, {
        hasText: typeof data?.text === 'string',
        textLength: typeof data?.text === 'string' ? data.text.length : 0,
        functionCallsCount: Array.isArray(data?.functionCalls) ? data.functionCalls.length : 0
      });

      handleAIResponse(data?.text || '', data?.functionCalls || []);

    } catch (e: any) {
      if (e?.code === 'functions/resource-exhausted' || e?.message?.includes?.('AI_LIMIT_REACHED')) {
        triggerAiLimitPopup();
        setIsLoading(false);
        return;
      }
      console.error(`[CHAT FRONTEND] Error sending message:`, {
        error: e.message,
        stack: e.stack,
        name: e.name,
        cause: e.cause
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionClick = (option: string) => {
    sendMessage(option);
  };


  if (!isOpen) return null;

  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex flex-col w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] bg-white rounded-2xl border-2 border-[#E5E5E5] border-b-4 overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b-2 border-[#E5E5E5] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Bot className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="font-bold text-sm text-[#4B4B4B]">{tutorName}</div>
            <div className="text-xs text-green-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
              Online
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
           {onSwitchToVoice && (
            <Button variant="ghost" size="icon" onClick={onSwitchToVoice} className="h-8 w-8 text-[#AFAFAF] hover:text-[#4B4B4B] hover:bg-transparent" title="Switch to Voice Mode">
              <Loader2 className="h-4 w-4" /> {/* Placeholder icon, will replace with Mic in parent */}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-[#AFAFAF] hover:text-[#4B4B4B] hover:bg-transparent">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-white space-y-4" ref={scrollAreaRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === 'user' 
                ? "bg-[#3B82F6] text-white rounded-br-none" 
                : "bg-[#F7F7F7] text-[#4B4B4B] border-2 border-[#E5E5E5] rounded-bl-none"
            )}>
              <div className="whitespace-pre-wrap font-medium">{msg.text}</div>
              
              {msg.options && msg.options.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.options.map((opt, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-2 px-3 text-xs border-2 border-[#E5E5E5] border-b-4 hover:bg-[#F0F9FF] hover:border-blue-200 text-[#4B4B4B] whitespace-normal active:translate-y-[4px] active:border-b-0"
                      onClick={() => handleOptionClick(opt)}
                      disabled={isLoading}
                    >
                      {opt}
                    </Button>
                  ))}
                  {msg.allowOther && (
                    <div className="text-xs text-[#AFAFAF] italic mt-1 text-center">
                      Or type your answer below
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex justify-start w-full">
             <div className="bg-[#F7F7F7] rounded-2xl rounded-bl-none px-4 py-3 border-2 border-[#E5E5E5]">
               <Loader2 className="h-4 w-4 animate-spin text-[#AFAFAF]" />
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t-2 border-[#E5E5E5] shrink-0">
        <form 
          onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }}
          className="flex gap-2"
        >
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border-2 border-[#E5E5E5] focus-visible:ring-0 focus-visible:border-blue-400 text-[#4B4B4B] placeholder:text-[#AFAFAF]"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            className="bg-[#3B82F6] hover:bg-blue-600 text-white shrink-0 border-b-4 border-blue-700 active:border-b-0 active:translate-y-[4px]"
            disabled={!inputText.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
