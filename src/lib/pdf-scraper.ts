// Only import pdfjs-dist on the client side to avoid SSR issues
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

function getPdfjsLib(): typeof import('pdfjs-dist') {
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction is only available in the browser');
  }
  
  if (!pdfjsLib) {
    // Lazy load to avoid SSR issues with DOMMatrix and other browser APIs
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfjsLib = require('pdfjs-dist') as typeof import('pdfjs-dist');
    // Set worker source to local public file to avoid CORS/CDN issues
    if ('Worker' in window && pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }
  
  if (!pdfjsLib) {
    throw new Error('Failed to load pdfjs-dist');
  }
  
  return pdfjsLib;
}

export interface ExtractedSatData {
  rawText: string;
  candidateName?: string;
  grade?: string;
  testDate?: string;
  totalScore?: number;
  sectionScores?: {
    math?: number;
    readingWriting?: number;
  };
  recordLocator?: string;
  percentiles?: {
    total?: number;
    readingWriting?: number;
    math?: number;
  };
  subscores?: Record<string, string>; // "Information and Ideas": "680-800" (usually ranges)
}

/**
 * Extracts all text from a PDF file.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const lib = getPdfjsLib();
  
  const arrayBuffer = await file.arrayBuffer();
  // Using a less resource-intensive loading strategy if possible, but for small score reports, 
  // standard loading is usually fine.
  const loadingTask = lib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  
  // SAT score reports are typically short (1-3 pages).
  // Iterate sequentially to maintain order.
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // items usually contains object with 'str' (the text) and 'transform' (position)
    // We can just join them for a raw dump.
    // Ideally, we'd sort by y-coordinate then x-coordinate to reconstruct layout,
    // but standard PDF flow often works okay for simple text extraction.
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
      
    fullText += pageText + '\n\n'; // Separate pages clearly
  }
  
  return fullText;
}

/**
 * Parses the raw text from an SAT score report PDF to extract relevant data.
 * Updated to robustly handle the specific layout provided.
 */
export function parseSatScoreReport(text: string): ExtractedSatData {
  const data: ExtractedSatData = {
    rawText: text,
    subscores: {}
  };

  try {
    // 1. Candidate Name
    // Pattern: "Found report for [Name] Grade:"
    // The text flow shows "Found report for" prepended by our logging in page.tsx, 
    // but in raw PDF text it often starts with the name line if it's the header.
    // Based on a sample snippet like: "Found report for Jane Doe Grade: 11"
    // We'll look for text before "Grade:"
    const nameMatch = text.match(/^(?:Name:\s+)?(.+?)\s+Grade:/i);
    if (nameMatch) {
      data.candidateName = nameMatch[1].trim();
    }

    // 2. Grade
    // Pattern: "Grade: 11"
    const gradeMatch = text.match(/Grade:\s*(\d+)/i);
    if (gradeMatch) {
      data.grade = gradeMatch[1];
    }

    // 3. Test Date
    // Pattern: "Test administration: SAT March 11, 2023"
    const testAdminMatch = text.match(/Test administration:\s*([A-Za-z0-9,\s]+?)(?=\s+Tested on:|$)/i);
    if (testAdminMatch) {
      data.testDate = testAdminMatch[1].replace('SAT ', '').trim();
    }

    // 3.5 Record Locator
    // Pattern: "Record Locator: 4091310902"
    const recordMatch = text.match(/Record Locator:\s*(\d+)/i);
    if (recordMatch) {
      data.recordLocator = recordMatch[1];
    }

    // 4. Total Score & Percentile
    // Pattern: "TOTAL SCORE 1500 ... 98th*"
    // We look for Total Score, then the number, and capture the percentile later if nearby.
    const totalScoreMatch = text.match(/TOTAL SCORE\s+(\d{3,4})[\s\S]*?(\d{1,2})(?:th|st|nd|rd)\*/i);
    if (totalScoreMatch) {
      data.totalScore = parseInt(totalScoreMatch[1]);
      data.percentiles = data.percentiles || {};
      data.percentiles.total = parseInt(totalScoreMatch[2]);
    } else {
      // Fallback if percentile not found in same group
      const simpleTotal = text.match(/TOTAL SCORE\s+(\d{3,4})/i);
      if (simpleTotal) data.totalScore = parseInt(simpleTotal[1]);
    }

    // 5. Section Scores & Percentiles
    data.sectionScores = {};
    
    // Reading and Writing
    // Pattern: "Reading and Writing 730 ... 97th*"
    const rwMatch = text.match(/Reading and Writing\s+(\d{3})[\s\S]*?(\d{1,2})(?:th|st|nd|rd)\*/i);
    if (rwMatch) {
      data.sectionScores.readingWriting = parseInt(rwMatch[1]);
      data.percentiles = data.percentiles || {};
      data.percentiles.readingWriting = parseInt(rwMatch[2]);
    }

    // Math
    // Pattern: "Math 770 ... 97th*"
    // Use negative lookbehind to ensure we don't match "Advanced Math"
    const mathMatch = text.match(/(?<!Advanced\s)Math\s+(\d{3})[\s\S]*?(\d{1,2})(?:th|st|nd|rd)\*/i);
    if (mathMatch) {
      data.sectionScores.math = parseInt(mathMatch[1]);
      data.percentiles = data.percentiles || {};
      data.percentiles.math = parseInt(mathMatch[2]);
    }

    // 6. Knowledge and Skills Subscores (Ranges)
    // These are formatted as "Category Name ... Performance: 680-800"
    // We will iterate through known categories to extract their ranges.

    const domains = [
      "Information and Ideas",
      "Craft and Structure",
      "Expression of Ideas",
      "Standard English Conventions",
      "Algebra",
      "Advanced Math",
      "Problem-Solving and Data Analysis",
      "Geometry and Trigonometry"
    ];

    data.subscores = {};

    domains.forEach(domain => {
      // Regex explanation:
      // 1. Literal domain name
      // 2. [\s\S]*? : Match any characters (including newlines) non-greedily until...
      // 3. Performance:\s* : The literal "Performance:" tag
      // 4. (\d{3}-\d{3}) : Capture the range (e.g., 680-800)
      const regex = new RegExp(`${domain}[\\s\\S]*?Performance:\\s*(\\d{3}-\\d{3})`, 'i');
      const match = text.match(regex);
      if (match) {
        data.subscores![domain] = match[1];
      }
    });

  } catch (e) {
    console.error("Error parsing SAT PDF text:", e);
  }

  return data;
}
