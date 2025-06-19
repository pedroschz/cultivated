import 'dotenv/config';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  throw new Error('Firebase Admin SDK credentials not set in environment variables.');
}

const app = initializeApp({
  credential: cert(serviceAccount as any),
});

const db = getFirestore(app);

/**
 * Upload questions using direct Firebase Storage URLs
 * No local file handling needed!
 */
async function uploadQuestionsWithDirectURLs() {
  try {
    // Questions with direct Firebase Storage URLs
    const questions = [
      {
        id: "math-graph-direct",
        field: 0, // Field: 0-46 (47 total fields)
        domain: 0, // Domain: 0-7 (8 total domains)
        difficulty: 1,
        question: "Based on the graph shown, what is the slope of the line?",
        options: ["2", "3", "4", "5"],
        answer: 1,
        // Use direct Firebase Storage URL
        questionImage: {
          url: "https://firebasestorage.googleapis.com/v0/b/your-project.firebasestorage.app/o/questions%2Fimages%2Fmath-graph.png?alt=media",
          alt: "Linear graph showing positive slope",
          caption: "Graph of y = 3x + 1"
        }
      },
      {
        id: "shapes-comparison",
        field: 3,
        domain: 3,
        difficulty: 0,
        question: "Which shape has the largest area?",
        options: [
          {
            text: "Red Shape",
            imageURL: "https://firebasestorage.googleapis.com/v0/b/your-project.firebasestorage.app/o/questions%2Fshapes%2Fred-square.png?alt=media",
            alt: "Red square with side length 5"
          },
          {
            text: "Blue Shape",
            imageURL: "https://firebasestorage.googleapis.com/v0/b/your-project.firebasestorage.app/o/questions%2Fshapes%2Fblue-circle.png?alt=media",
            alt: "Blue circle with radius 3"
          },
          {
            text: "Green Shape",
            imageURL: "https://firebasestorage.googleapis.com/v0/b/your-project.firebasestorage.app/o/questions%2Fshapes%2Fgreen-triangle.png?alt=media",
            alt: "Green triangle with base 8 and height 6"
          }
        ],
        answer: 0
      }
    ];

    const questionsCollection = db.collection('questions');

    // Upload each question
    for (const question of questions) {
      console.log(`Uploading question: ${question.id}`);
      
      await questionsCollection.doc(question.id).set(question);
      
      console.log(`✅ Successfully uploaded: ${question.id}`);
    }

    console.log('\n🎉 All questions uploaded successfully!');
    console.log('\n💡 To get Firebase Storage URLs for your images:');
    console.log('1. Go to Firebase Console → Storage');
    console.log('2. Upload your images');
    console.log('3. Click the image → Copy download URL');
    console.log('4. Use that URL in your questions');
    
  } catch (error) {
    console.error('❌ Error during upload:', error);
  } finally {
    process.exit(0);
  }
}

uploadQuestionsWithDirectURLs(); 