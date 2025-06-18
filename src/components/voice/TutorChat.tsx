import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Volume2, 
  VolumeX, 
  Lightbulb,
  ArrowRight,
  CheckCircle,
  BookOpen
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'tutor';
  text: string;
  timestamp: Date;
  concepts?: string[];
  followUpQuestions?: string[];
}

interface TutorChatProps {
  isOpen: boolean;
  questionText: string;
  userAnswer: string | number;
  correctAnswer: string | number;
  thinkingTranscript?: string;
  onClose: () => void;
  onContinuePractice: () => void;
  className?: string;
}

export function TutorChat({
  isOpen,
  questionText,
  userAnswer,
  correctAnswer,
  thinkingTranscript,
  onClose,
  onContinuePractice,
  className
}: TutorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize conversation when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      initializeTutorConversation();
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const initializeTutorConversation = async () => {
    setIsLoading(true);
    
    // Simulate initial tutor response - in real implementation, call Gemini API
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const initialMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'tutor',
      text: `I noticed you selected "${userAnswer}" but the correct answer is "${correctAnswer}". Let me help you understand where the confusion might be coming from. ${thinkingTranscript ? "I heard you thinking through the problem - " : ""}Can you tell me what made you choose that answer?`,
      timestamp: new Date(),
      concepts: ['Problem Analysis', 'Answer Choice Strategy'],
      followUpQuestions: [
        "What was your reasoning for that choice?",
        "Which part of the question seemed most challenging?",
        "Did any of the other options seem close?"
      ]
    };
    
    setMessages([initialMessage]);
    
    if (autoSpeak) {
      speakMessage(initialMessage.text);
    }
    
    setIsLoading(false);
  };

  const speakMessage = (text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: inputValue.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    // Simulate tutor response - in real implementation, call Gemini API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const tutorResponses = [
      "That's a great question! Let me break this down step by step...",
      "I can see how that might be confusing. The key thing to remember is...",
      "Exactly! You're getting the hang of this. Let's make sure you understand...",
      "Good insight! Now let's connect this to the broader concept..."
    ];
    
    const tutorMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'tutor',
      text: tutorResponses[Math.floor(Math.random() * tutorResponses.length)],
      timestamp: new Date(),
      concepts: ['Step-by-step Analysis'],
      followUpQuestions: [
        "Does that make sense now?",
        "Would you like to try a similar problem?",
        "Any other questions about this concept?"
      ]
    };
    
    setMessages(prev => [...prev, tutorMessage]);
    
    if (autoSpeak) {
      speakMessage(tutorMessage.text);
    }
    
    setIsLoading(false);
  };

  const handleFollowUpQuestion = (question: string) => {
    setInputValue(question);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className={cn("w-full max-w-2xl h-[600px] flex flex-col", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              AI Tutor Session
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoSpeak(!autoSpeak)}
                className="gap-2"
              >
                {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {autoSpeak ? 'Audio On' : 'Audio Off'}
              </Button>
              {isSpeaking && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={stopSpeaking}
                  className="gap-2"
                >
                  <VolumeX className="h-4 w-4" />
                  Stop
                </Button>
              )}
            </div>
          </CardTitle>
          
          {/* Question Context */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p className="font-medium mb-1">Question Context:</p>
            <p className="text-gray-700 line-clamp-2">{questionText}</p>
            <div className="flex gap-4 mt-2 text-xs">
              <span>Your Answer: <Badge variant="destructive">{userAnswer}</Badge></span>
              <span>Correct Answer: <Badge variant="default">{correctAnswer}</Badge></span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col gap-4 p-4">
          {/* Chat Messages */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.type === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.type === 'tutor' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  
                  <div className={cn(
                    "max-w-[80%] rounded-lg p-3",
                    message.type === 'user' 
                      ? "bg-blue-600 text-white" 
                      : "bg-gray-100 text-gray-900"
                  )}>
                    <p className="text-sm">{message.text}</p>
                    
                    {/* Concepts */}
                    {message.concepts && message.concepts.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {message.concepts.map((concept, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <Lightbulb className="h-3 w-3 mr-1" />
                            {concept}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Follow-up Questions */}
                    {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium opacity-70">Quick responses:</p>
                        {message.followUpQuestions.map((question, index) => (
                          <Button
                            key={index}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFollowUpQuestion(question)}
                            className="w-full justify-start text-xs h-auto p-2 bg-white/50"
                          >
                            <ArrowRight className="h-3 w-3 mr-1" />
                            {question}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {message.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <Separator />
          
          {/* Input Area */}
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask a question or explain your thinking..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={onContinuePractice}
              className="flex-1 gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Continue Practice
            </Button>
            <Button 
              onClick={onClose}
              variant="outline"
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Review More
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 