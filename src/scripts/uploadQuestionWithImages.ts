import 'dotenv/config';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
  console.log('Loaded environment variables from .env.local');
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('Loaded environment variables from .env');
}

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  throw new Error(
    'Firebase Admin SDK Service Account credentials are not fully set in environment variables. ' +
    'Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
  );
}

const app = initializeApp({
  credential: cert(serviceAccount as any),
  storageBucket: `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
});

const db = getFirestore(app);
const storage = getStorage(app);

interface ImageUpload {
  localPath: string;
  remotePath?: string;
}

interface QuestionWithImages {
  id: string;
  field: number; // 0-46 (47 total fields)
  domain: number; // 0-7 (8 total domains)
  difficulty: number;
  question: string;
  options: string[] | Array<{text?: string; imageURL?: string; alt?: string}> | string;
  answer: number | string;
  passage?: string;
  // Image fields
  questionImage?: ImageUpload;
  imageURL?: string; // Legacy field
}

/**
 * Upload an image file to Firebase Storage
 */
async function uploadImage(localPath: string, remotePath?: string): Promise<string> {
  const bucket = storage.bucket();
  
  if (!fs.existsSync(localPath)) {
    throw new Error(`Image file not found: ${localPath}`);
  }

  // Generate remote path if not provided
  if (!remotePath) {
    const ext = path.extname(localPath);
    const filename = `${uuidv4()}${ext}`;
    remotePath = `questions/images/${filename}`;
  }

  console.log(`Uploading ${localPath} to ${remotePath}...`);
  
  // Upload the file
  const [file] = await bucket.upload(localPath, {
    destination: remotePath,
    metadata: {
      metadata: {
        uploadedAt: new Date().toISOString(),
        originalName: path.basename(localPath)
      }
    }
  });

  // Get the download URL
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-09-2491' // Far future date for permanent access
  });

  console.log(`✅ Image uploaded successfully: ${url}`);
  return url;
}

/**
 * Process a question with images and upload everything
 */
async function processQuestionWithImages(questionData: QuestionWithImages): Promise<any> {
  const processedQuestion = { ...questionData };

  // Upload question image if provided
  if (questionData.questionImage?.localPath) {
    const imageUrl = await uploadImage(
      questionData.questionImage.localPath, 
      questionData.questionImage.remotePath
    );
    
    // Use enhanced format
    (processedQuestion as any).questionImage = {
      url: imageUrl,
      alt: `Illustration for question ${questionData.id}`,
      caption: questionData.questionImage.remotePath ? path.basename(questionData.questionImage.remotePath) : undefined
    };
    
    // Also set legacy field for backward compatibility
    processedQuestion.imageURL = imageUrl;
  }

  // Process option images if they exist
  if (Array.isArray(questionData.options)) {
    const processedOptions = await Promise.all(
      questionData.options.map(async (option, index) => {
        if (typeof option === 'string') {
          return option; // Keep string options as-is
        }
        
        // Handle enhanced option format
        const processedOption = { ...option };
        
        if (option.imageURL && !option.imageURL.startsWith('http')) {
          // This is a local path, upload it
          const imageUrl = await uploadImage(option.imageURL);
          processedOption.imageURL = imageUrl;
          processedOption.alt = processedOption.alt || `Option ${String.fromCharCode(65 + index)}`;
        }
        
        return processedOption;
      })
    );
    
    (processedQuestion as any).options = processedOptions;
  }

  // Clean up local file references
  delete (processedQuestion as any).questionImage?.localPath;
  delete (processedQuestion as any).questionImage?.remotePath;

  return processedQuestion;
}

/**
 * Upload questions with images to Firestore
 */
async function uploadQuestionsWithImages() {
  try {
    // Example usage - you can modify this to read from a JSON file or define questions here
    const questionsWithImages: QuestionWithImages[] = [
      {
        id: "example-with-image",
        field: 0,
        domain: 0,
        difficulty: 0,
        question: "What does this graph show?",
        options: ["Increasing trend", "Decreasing trend", "No trend", "Cyclical pattern"],
        answer: 0,
        // Specify local image path
        questionImage: {
          localPath: "./images/example-graph.png", // Put your image file here
          remotePath: "questions/example-graph.png" // Optional: specify remote path
        }
      },
      {
        id: "example-with-option-images",
        field: 1,
        domain: 0,
        difficulty: 1,
        question: "Which shape is a circle?",
        options: [
          {
            text: "Shape A",
            imageURL: "./images/square.png", // Local path to be uploaded
            alt: "A square shape"
          },
          {
            text: "Shape B", 
            imageURL: "./images/circle.png", // Local path to be uploaded
            alt: "A circular shape"
          },
          {
            text: "Shape C",
            imageURL: "./images/triangle.png", // Local path to be uploaded
            alt: "A triangular shape"
          }
        ],
        answer: 1
      }
    ];

    // You can also load from a JSON file:
    // const questionsPath = path.join(process.cwd(), 'questions-with-images.json');
    // const questionsWithImages = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

    const questionsCollection = db.collection('questions');

    // Process and upload each question
    for (const questionData of questionsWithImages) {
      console.log(`\nProcessing question: ${questionData.id}`);
      
      try {
        // Process images and get the final question data
        const processedQuestion = await processQuestionWithImages(questionData);
        
        // Upload to Firestore
        await questionsCollection.doc(questionData.id).set(processedQuestion);
        
        console.log(`✅ Successfully uploaded question: ${questionData.id}`);
      } catch (error) {
        console.error(`❌ Error processing question ${questionData.id}:`, error);
      }
    }

    console.log('\n🎉 All questions with images have been uploaded successfully!');
  } catch (error) {
    console.error('❌ Error during upload:', error);
  } finally {
    process.exit(0);
  }
}

// Run the upload
uploadQuestionsWithImages(); 