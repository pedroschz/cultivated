import 'dotenv/config';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local if it exists, otherwise fallback to .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
  console.log('Loaded environment variables from .env.local');
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('Loaded environment variables from .env');
} else {
  console.warn('No .env.local or .env file found. Environment variables may be missing.');
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
});

const db = getFirestore(app);

async function uploadQuestions() {
  try {
    // Read the JSON file
    const questionsPath = path.join(process.cwd(), 'questions.json');
    console.log('Reading questions from:', questionsPath);
    const rawContent = fs.readFileSync(questionsPath, 'utf8');
    console.log('Raw file content:', rawContent);
    const questionsData = JSON.parse(rawContent);

    // Get a reference to the questions collection
    const questionsCollection = db.collection('questions');

    // Upload each question
    const uploadPromises = questionsData.map(async (question: any) => {
      try {
        // Use the question's id as the document ID
        await questionsCollection.doc(question.id).set(question);
        console.log(`Successfully uploaded question with ID: ${question.id}`);
      } catch (error) {
        console.error(`Error uploading question ${question.id}:`, error);
      }
    });

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);
    console.log('All questions have been uploaded successfully!');
  } catch (error) {
    console.error('Error during upload:', error);
  } finally {
    // Clean up
    process.exit(0);
  }
}

// Run the upload
uploadQuestions(); 