"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { app, auth } from '@/lib/firebaseClient';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Send, Loader2, Mic, ChevronLeft, ChevronRight, Bot, XIcon, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompactVoiceConversation } from '@/components/voice/CompactVoiceConversation';
import { triggerAiLimitPopup } from '@/lib/ai/usageClient';

import { LatexRenderer } from '@/components/ui/latex';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  options?: string[];
  allowOther?: boolean;
  isToolCall?: boolean;
}

interface TutorSidebarProps {
  question: {
    question: string;
    options: string[] | string;
    answer: number | string;
    passage?: string;
    explanation?: string;
  };
  userAnswer: string | number;
  hasSubmittedAnswer?: boolean;
  highlightsCsv?: string;
  tutorName?: string;
  tutorVoice?: string;
  resetKey?: string;
  procedureTranscript?: string;
  procedureStatus?: 'ok' | 'warning';
  className?: string;
  textSize?: number;
  onOpenChange?: (isOpen: boolean) => void;
}

export function TutorSidebar({
  question,
  userAnswer,
  hasSubmittedAnswer = false,
  highlightsCsv,
  tutorName: preloadedTutorName,
  tutorVoice,
  resetKey,
  procedureTranscript,
  procedureStatus,
  className,
  textSize = 2,
  onOpenChange
}: TutorSidebarProps) {
  const [isOpen, setIsOpenState] = useState(true);
  const explanationSentRef = useRef(false);

  const setIsOpen = (value: boolean) => {
    setIsOpenState(value);
    onOpenChange?.(value);
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tutorName, setTutorName] = useState<string>(preloadedTutorName || 'AI Tutor');
  const [userName, setUserName] = useState('Student');
  const [userInterests, setUserInterests] = useState<{role: string, text: string}[]>([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [width, setWidth] = useState(320); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitializingRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(320);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isVoiceMode]);

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

  // Reset chat when resetKey changes (new question)
  useEffect(() => {
    if (resetKey) {
      setMessages([]);
      setIsLoading(false);
      isInitializingRef.current = false;
      explanationSentRef.current = false;
    }
  }, [resetKey]);

  // Send explanation when answer is submitted (preserves all previous chat messages)
  useEffect(() => {
    if (hasSubmittedAnswer && question.explanation && !explanationSentRef.current) {
      // Add explanation message from tutor - preserve all existing messages
      setMessages(prev => {
        // Check if explanation was already added (avoid duplicates)
        const hasExplanation = prev.some(msg => 
          msg.role === 'model' && msg.text.includes('Here is the explanation for this question')
        );
        if (hasExplanation) {
          return prev;
        }
        // Append explanation to existing messages, preserving all previous chat
        return [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'model',
            text: `Here is the explanation for this question:\n\n${question.explanation}`,
          }
        ];
      });
      explanationSentRef.current = true;
    }
  }, [hasSubmittedAnswer, question.explanation, resetKey]);


  // Resize handler
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartXRef.current;
      const newWidth = Math.max(200, Math.min(600, resizeStartWidthRef.current + diff));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = width;
  };

  const startChatSession = async () => {
    setIsLoading(true);
    try {
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

    if (!isHidden) {
        const userMsgId = Date.now().toString();
        setMessages(prev => [...prev, { id: userMsgId, role: 'user', text }]);
        setInputText('');
    }
    
    setIsLoading(true);

    try {
      const currentHistory = historyOverride || messages;
      
      // Build history, ensuring it starts with a 'user' message (API requirement)
      let historyForApi = currentHistory.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      })).filter(m => m.parts[0].text !== "Start the session.");
      
      // Remove any leading 'model' messages - history must start with 'user'
      while (historyForApi.length > 0 && historyForApi[0].role === 'model') {
        historyForApi = historyForApi.slice(1);
      }
      
      // If no history remains, add a dummy user message to satisfy API requirement
      if (historyForApi.length === 0 || historyForApi[0].role !== 'user') {
        historyForApi = [{ role: 'user', parts: [{ text: 'Start the conversation.' }] }, ...historyForApi];
      }

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
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `Sorry, I encountered an error: ${e.message || 'Unable to process your message. Please try again.'}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionClick = (option: string) => {
    sendMessage(option);
  };

  const textSizeClass = {
    1: 'text-xs',
    2: 'text-sm',
    3: 'text-base',
    4: 'text-lg',
    5: 'text-xl',
  }[textSize] || 'text-sm';

  const optionTextSizeClass = {
    1: 'text-[10px]',
    2: 'text-xs',
    3: 'text-sm',
    4: 'text-base',
    5: 'text-lg',
  }[textSize] || 'text-xs';

  if (!isOpen) {
      return (
          <div 
            className={cn("fixed left-4 bottom-28 md:bottom-32 z-[60] bg-white dark:bg-card rounded-lg border-2 border-[#E5E5E5] dark:border-border border-b-4 p-2 cursor-pointer flex items-center justify-center transition-all duration-300 w-10 h-10")} 
            onClick={() => setIsOpen(true)}
          >
              <Bot className="h-5 w-5 text-[#AFAFAF] dark:text-muted-foreground" />
          </div>
      );
  }

  return (
    <div 
      ref={sidebarRef}
      className={cn(
        "flex flex-col bg-white dark:bg-card border-r-2 border-b-2 border-[#E5E5E5] dark:border-border shrink-0 transition-all duration-300 relative overflow-hidden z-[60]",
        "!h-[calc(100vh-112px)]",
        className
      )}
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-[#93d333]/30 z-10 transition-colors"
        title="Drag to resize"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-card border-b-2 border-[#E5E5E5] dark:border-border shrink-0">
        <div className="font-bold text-base text-[#4B4B4B] dark:text-foreground truncate min-w-0">{tutorName}</div>

        {/* Segmented Text/Voice toggle */}
        <div
          role="tablist"
          aria-label="Tutor mode"
          className="relative inline-flex items-center shrink-0 bg-[#F7F7F7] dark:bg-muted rounded-full p-0.5 border border-[#E5E5E5] dark:border-border"
        >
          {/* Sliding active pill */}
          <motion.div
            aria-hidden
            className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-white dark:bg-card shadow-sm border border-[#E5E5E5] dark:border-border"
            animate={{ x: isVoiceMode ? 'calc(100% + 2px)' : '2px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={!isVoiceMode}
            onClick={() => setIsVoiceMode(false)}
            className={cn(
              "relative z-[1] flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors",
              !isVoiceMode
                ? "text-[#4B4B4B] dark:text-foreground"
                : "text-[#AFAFAF] dark:text-muted-foreground hover:text-[#4B4B4B] dark:hover:text-foreground"
            )}
          >
            <Type className="h-3.5 w-3.5" />
            Text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isVoiceMode}
            onClick={() => setIsVoiceMode(true)}
            className={cn(
              "relative z-[1] flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors",
              isVoiceMode
                ? "text-[#4B4B4B] dark:text-foreground"
                : "text-[#AFAFAF] dark:text-muted-foreground hover:text-[#4B4B4B] dark:hover:text-foreground"
            )}
          >
            <Mic className="h-3.5 w-3.5" />
            Voice
          </button>
        </div>

        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-[#AFAFAF] dark:text-muted-foreground hover:text-[#4B4B4B] dark:hover:text-foreground hover:bg-transparent shrink-0">
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Body: in-place mode swap */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {isVoiceMode ? (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              <CompactVoiceConversation
                isOpen={true}
                variant="panel"
                onClose={() => setIsVoiceMode(false)}
                question={question}
                userAnswer={userAnswer}
                thinkingAudio={null}
                tutorName={tutorName}
                tutorVoice={tutorVoice}
                resetKey={resetKey}
                hasSubmittedAnswer={hasSubmittedAnswer}
                highlightsCsv={highlightsCsv}
                onSwitchToText={() => setIsVoiceMode(false)}
                className="h-full"
              />
            </motion.div>
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute inset-0 flex flex-col"
            >
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 pb-24 bg-white dark:bg-card space-y-4">
                {messages.length === 0 && !isLoading && (
                  <div className="flex items-center justify-center h-full">
                    <Button
                      onClick={startChatSession}
                      className="bg-[#93d333] hover:bg-[#79b933] text-white border-2 border-[#79b933] border-b-4 active:border-b-0 active:translate-y-[4px]"
                    >
                      Start Chat
                    </Button>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex w-full",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5",
                      textSizeClass,
                      msg.role === 'user'
                        ? "bg-[#93d333] text-white rounded-br-none"
                        : "bg-[#F7F7F7] dark:bg-muted text-[#4B4B4B] dark:text-foreground border-2 border-[#E5E5E5] dark:border-border border-b-4 rounded-bl-none"
                    )}>
                      <div className="whitespace-pre-wrap font-medium">
                        <LatexRenderer>{msg.text}</LatexRenderer>
                      </div>

                      {msg.options && msg.options.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.options.map((opt, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left h-auto py-2 px-3 border-2 border-[#E5E5E5] dark:border-border border-b-4 hover:bg-[#F7F7F7] dark:hover:bg-muted/50 hover:border-[#93d333]/50 dark:hover:border-[#93d333]/50 text-[#4B4B4B] dark:text-foreground whitespace-normal active:translate-y-[4px] active:border-b-0",
                                optionTextSizeClass
                              )}
                              onClick={() => handleOptionClick(opt)}
                              disabled={isLoading}
                            >
                              {opt}
                            </Button>
                          ))}
                          {msg.allowOther && (
                            <div className="text-xs text-[#AFAFAF] dark:text-muted-foreground italic mt-1 text-center">
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
                    <div className="bg-[#F7F7F7] dark:bg-muted rounded-2xl rounded-bl-none px-4 py-3 border-2 border-[#E5E5E5] dark:border-border border-b-4">
                      <Loader2 className="h-4 w-4 animate-spin text-[#AFAFAF] dark:text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="absolute bottom-6 left-4 right-4 z-20">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }}
                  className="flex gap-2 items-center bg-white dark:bg-card border-2 border-[#E5E5E5] dark:border-border rounded-full p-1.5"
                >
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 border-0 focus-visible:ring-0 shadow-none bg-transparent text-[#4B4B4B] dark:text-foreground placeholder:text-[#AFAFAF] dark:placeholder:text-muted-foreground h-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="bg-[#93d333] hover:bg-[#79b933] text-white shrink-0 border-0 rounded-full w-10 h-10"
                    disabled={!inputText.trim() || isLoading}
                  >
                    <Send className="h-4 w-4 ml-0.5" />
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
