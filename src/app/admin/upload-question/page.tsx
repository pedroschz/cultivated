"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc } from 'firebase/firestore';
import { auth, app } from '@/lib/firebaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';

// Admin page constants
const ALLOWED_EMAILS = [
  'pedrosanchezgilg@icloud.com'
];

export default function UploadQuestionPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [questionData, setQuestionData] = useState({
    id: '',
    field: 0,
    domain: 0,
    difficulty: 0,
    question: '',
    options: ['', '', '', ''],
    answer: 0,
    passage: ''
  });
  const [questionImage, setQuestionImage] = useState<File | null>(null);
  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(null);
  const [optionImages, setOptionImages] = useState<(File | null)[]>([null, null, null, null]);
  const [optionImagePreviews, setOptionImagePreviews] = useState<(string | null)[]>([null, null, null, null]);
  const [jsonContent, setJsonContent] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string[]>([]);
      
    const router = useRouter();
    
    // Initialize Firebase only on client side
    const [storage, setStorage] = useState<any>(null);
    const [db, setDb] = useState<any>(null);
    
    useEffect(() => {
      if (typeof window !== 'undefined' && app) {
        const { getStorage } = require('firebase/storage');
        const { getFirestore } = require('firebase/firestore');
        setStorage(getStorage(app));
        setDb(getFirestore(app));
      }
    }, []);
  
    // Auth check
  useEffect(() => {
    if (!auth) return;
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        router.push('/login');
      } else {
        // Optional: Whitelist specific team members
        const authorizedEmails = [
          'pedrosanchezgilg@icloud.com'
          // Add your team's email addresses here
        ];
        
        if (currentUser.email && !authorizedEmails.includes(currentUser.email)) {
          toast.error('You are not authorized to access this page');
          router.push('/dashboard');
          return;
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Image preview handling
  const handleQuestionImageChange = (file: File | null) => {
    setQuestionImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setQuestionImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setQuestionImagePreview(null);
    }
  };

  const handleOptionImageChange = (index: number, file: File | null) => {
    const newImages = [...optionImages];
    const newPreviews = [...optionImagePreviews];
    
    newImages[index] = file;
    setOptionImages(newImages);
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews[index] = e.target?.result as string;
        setOptionImagePreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    } else {
      newPreviews[index] = null;
      setOptionImagePreviews(newPreviews);
    }
  };

  const uploadImageToStorage = async (file: File, path: string): Promise<string> => {
    try {
      console.log(`Uploading image to: ${path}`);
      const fileRef = storageRef(storage, path);
      
      // Upload with metadata
      const metadata = {
        customMetadata: {
          uploadedBy: user?.uid || 'unknown',
          uploadedAt: new Date().toISOString(),
          originalName: file.name
        }
      };
      
          const snapshot = await uploadBytes(fileRef, file, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log(`✅ Image uploaded successfully: ${downloadURL}`);
      return downloadURL;
    } catch (error) {
      console.error(`❌ Error uploading image to ${path}:`, error);
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const uploadSingleQuestion = async (questionData: Record<string, unknown>): Promise<void> => {
    if (!storage || !db) {
      throw new Error('Firebase not initialized');
    }
    const processedQuestion: Record<string, unknown> = { ...questionData };
    let currentProgress = 0;
    const totalSteps = 1 + (questionImage ? 1 : 0) + optionImages.filter(img => img).length;

    // Upload question image if provided
    if (questionImage) {
      try {
        const imageUrl = await uploadImageToStorage(
          questionImage, 
          `questions/images/${questionData.id}-question.${questionImage.name.split('.').pop()}`
        );
        processedQuestion.questionImage = {
          url: imageUrl,
          alt: `Illustration for question ${questionData.id}`
        };
        processedQuestion.imageURL = imageUrl; // Legacy support
        currentProgress++;
        setUploadProgress((currentProgress / totalSteps) * 100);
      } catch (error) {
        throw new Error(`Failed to upload question image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Process options and upload option images
    processedQuestion.options = await Promise.all(
      (questionData.options as string[]).map(async (optionText: string, optionIndex: number) => {
        const optionImage = optionImages[optionIndex];
        
        if (optionImage) {
          try {
            const imageUrl = await uploadImageToStorage(
              optionImage,
              `questions/options/${questionData.id}-option-${optionIndex}.${optionImage.name.split('.').pop()}`
            );
            
            currentProgress++;
            setUploadProgress((currentProgress / totalSteps) * 100);
            
            return {
              text: optionText || `Option ${String.fromCharCode(65 + optionIndex)}`,
              imageURL: imageUrl,
              alt: `Option ${String.fromCharCode(65 + optionIndex)}`
            };
          } catch (error) {
            throw new Error(`Failed to upload option ${optionIndex} image: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          return optionText;
        }
      })
    );

    // Upload to Firestore
    try {
      await setDoc(doc(collection(db, 'questions'), questionData.id as string), processedQuestion);
      currentProgress++;
      setUploadProgress((currentProgress / totalSteps) * 100);
      
      const message = `✅ Question "${questionData.id}" uploaded successfully`;
      setUploadStatus(prev => [...prev, message]);
      console.log(message);
    } catch (error) {
      throw new Error(`Failed to save question to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSingleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('You must be logged in to upload questions');
      return;
    }
    
    if (!questionData.id || !questionData.question) {
      toast.error('Please fill in required fields');
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus([]);
    
    try {
      await uploadSingleQuestion(questionData);
      toast.success('Question uploaded successfully!');
      
      // Reset form
      setQuestionData({
        id: '',
        field: 0,
        domain: 0,
        difficulty: 0,
        question: '',
        options: ['', '', '', ''],
        answer: 0,
        passage: ''
      });
      setQuestionImage(null);
      setQuestionImagePreview(null);
      setOptionImages([null, null, null, null]);
      setOptionImagePreviews([null, null, null, null]);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload question');
      setUploadStatus(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleJsonUpload = async () => {
    if (!user) {
      toast.error('You must be logged in to upload questions');
      return;
    }
    
    if (!jsonContent.trim()) {
      toast.error('Please enter JSON content');
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadStatus([]);

    try {
      const questions = JSON.parse(jsonContent);
      if (!Array.isArray(questions)) {
        throw new Error('JSON must contain an array of questions');
      }

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        if (!question.id) {
          throw new Error(`Question at index ${i} is missing an ID`);
        }
        
        try {
          // For JSON upload, we only handle direct URLs (no file uploads)
          await setDoc(doc(collection(db, 'questions'), question.id), question);
          
          const progress = ((i + 1) / questions.length) * 100;
          setUploadProgress(progress);
          setUploadStatus(prev => [...prev, `✅ Uploaded question: ${question.id}`]);
        } catch (error) {
          const errorMessage = `❌ Failed to upload question ${question.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          setUploadStatus(prev => [...prev, errorMessage]);
          console.error(errorMessage);
        }
      }

      toast.success(`Uploaded ${questions.length} questions from JSON`);
      setJsonContent('');
      
    } catch (error) {
      console.error('JSON upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse JSON');
      setUploadStatus(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <span className="text-yellow-800">Please log in to access the question upload tool.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Questions with Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="single" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Single Question
              </TabsTrigger>
              <TabsTrigger value="json" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                JSON Upload
              </TabsTrigger>
            </TabsList>

            {/* Progress and Status */}
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Upload Progress</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {uploadStatus.length > 0 && (
              <div className="bg-muted p-3 rounded max-h-32 overflow-y-auto">
                {uploadStatus.map((status, index) => (
                  <div key={index} className="text-sm font-mono">
                    {status}
                  </div>
                ))}
              </div>
            )}

            <TabsContent value="single">
              <form onSubmit={handleSingleQuestionSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="id">Question ID*</Label>
                    <Input
                      id="id"
                      value={questionData.id}
                      onChange={(e) => setQuestionData(prev => ({ ...prev, id: e.target.value }))}
                      placeholder="unique-id"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="field">Field (0-46)</Label>
                    <Input
                      id="field"
                      type="number"
                      min="0"
                      max="46"
                      value={questionData.field}
                      onChange={(e) => setQuestionData(prev => ({ ...prev, field: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="domain">Domain (0-7)</Label>
                    <Input
                      id="domain"
                      type="number"
                      min="0"
                      max="7"
                      value={questionData.domain}
                      onChange={(e) => setQuestionData(prev => ({ ...prev, domain: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Input
                      id="difficulty"
                      type="number"
                      min="0"
                      max="2"
                      value={questionData.difficulty}
                      onChange={(e) => setQuestionData(prev => ({ ...prev, difficulty: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                {/* Question */}
                <div>
                  <Label htmlFor="question">Question*</Label>
                  <Textarea
                    id="question"
                    value={questionData.question}
                    onChange={(e) => setQuestionData(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="Enter your question here..."
                    required
                  />
                </div>

                {/* Question Image */}
                <div>
                  <Label htmlFor="question-image">Question Image (Optional)</Label>
                  <Input
                    id="question-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleQuestionImageChange(e.target.files?.[0] || null)}
                  />
                  {questionImagePreview && (
                    <div className="mt-2">
                      <img 
                        src={questionImagePreview} 
                        alt="Question preview" 
                        className="max-w-md max-h-32 object-contain border rounded"
                      />
                    </div>
                  )}
                </div>

                {/* Options */}
                <div>
                  <Label>Answer Options</Label>
                  <div className="space-y-3">
                    {questionData.options.map((option, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="flex-1">
                          <Label htmlFor={`option-${index}`}>Option {String.fromCharCode(65 + index)}</Label>
                          <Input
                            id={`option-${index}`}
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...questionData.options];
                              newOptions[index] = e.target.value;
                              setQuestionData(prev => ({ ...prev, options: newOptions }));
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor={`option-image-${index}`}>Image (Optional)</Label>
                          <Input
                            id={`option-image-${index}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleOptionImageChange(index, e.target.files?.[0] || null)}
                          />
                          {optionImagePreviews[index] && (
                            <img 
                              src={optionImagePreviews[index]!} 
                              alt={`Option ${index} preview`} 
                              className="mt-1 w-16 h-16 object-cover border rounded"
                            />
                          )}
                        </div>
                        <div className="w-20 pt-6">
                          <Label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="correct-answer"
                              checked={questionData.answer === index}
                              onChange={() => setQuestionData(prev => ({ ...prev, answer: index }))}
                            />
                            Correct
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Passage */}
                <div>
                  <Label htmlFor="passage">Reading Passage (Optional)</Label>
                  <Textarea
                    id="passage"
                    value={questionData.passage}
                    onChange={(e) => setQuestionData(prev => ({ ...prev, passage: e.target.value }))}
                    placeholder="Enter reading passage if applicable..."
                    rows={4}
                  />
                </div>

                <Button type="submit" disabled={loading || !storage || !db} className="w-full">
                  {loading ? 'Uploading...' : 'Upload Question'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="json" className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800">Upload multiple questions from JSON. For images, use direct Firebase Storage URLs in your JSON.</span>
              </div>
              
              <div>
                <Label htmlFor="json-content">Questions JSON*</Label>
                <Textarea
                  id="json-content"
                  value={jsonContent}
                  onChange={(e) => setJsonContent(e.target.value)}
                  placeholder={`[
  {
    "id": "question-1",
    "field": 0,
    "domain": 0,
    "difficulty": 1,
    "question": "What is 2 + 2?",
    "options": ["3", "4", "5", "6"],
    "answer": 1,
    "questionImage": {
      "url": "https://firebasestorage.googleapis.com/.../image.png",
      "alt": "Math illustration"
    }
  }
]`}
                  rows={15}
                  className="font-mono text-sm"
                  required
                />
              </div>
              
              <Button 
                onClick={handleJsonUpload} 
                disabled={loading || !jsonContent.trim() || !storage || !db}
                className="w-full"
              >
                {loading ? 'Uploading...' : 'Upload from JSON'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 