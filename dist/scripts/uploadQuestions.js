"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Load .env.local if it exists, otherwise fallback to .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
    console.log('Loaded environment variables from .env.local');
}
else if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('Loaded environment variables from .env');
}
else {
    console.warn('No .env.local or .env file found. Environment variables may be missing.');
}
// Initialize Firebase Admin
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (_a = process.env.FIREBASE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n'),
};
if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    throw new Error('Firebase Admin SDK Service Account credentials are not fully set in environment variables. ' +
        'Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
}
const app = (0, app_1.initializeApp)({
    credential: (0, app_1.cert)(serviceAccount),
});
const db = (0, firestore_1.getFirestore)(app);
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
        const uploadPromises = questionsData.map(async (question) => {
            try {
                // Use the question's id as the document ID
                await questionsCollection.doc(question.id).set(question);
                console.log(`Successfully uploaded question with ID: ${question.id}`);
            }
            catch (error) {
                console.error(`Error uploading question ${question.id}:`, error);
            }
        });
        // Wait for all uploads to complete
        await Promise.all(uploadPromises);
        console.log('All questions have been uploaded successfully!');
    }
    catch (error) {
        console.error('Error during upload:', error);
    }
    finally {
        // Clean up
        process.exit(0);
    }
}
// Run the upload
uploadQuestions();
