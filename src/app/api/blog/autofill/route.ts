import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { verifyAuth } from '@/lib/api-auth';

export const dynamic = "force-static";


export async function POST(req: NextRequest) {
  try {
    // Verify Authentication
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { topic, title, category } = await req.json();

    if (!topic && !title) {
      return NextResponse.json({ error: 'Topic or title is required' }, { status: 400 });
    }

    // Use Server-Side Key Only
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const client = new GoogleGenAI({ 
      apiKey,
      httpOptions: { apiVersion: 'v1alpha' } 
    });

    // Build the prompt for blog post generation
    let prompt = `Write a comprehensive, engaging blog post for a SAT prep education platform called CultivatED. `;
    
    if (title) {
      prompt += `The title should be: "${title}". `;
    }
    
    if (topic) {
      prompt += `The topic is: ${topic}. `;
    }
    
    if (category) {
      prompt += `The category is: ${category}. `;
    }

    prompt += `
    
Requirements:
1. Write in HTML format using proper semantic HTML tags (h2, h3, p, ul, ol, li, strong, em, etc.)
2. Do NOT include <html>, <head>, or <body> tags - just the content
3. Start with an <h2>Introduction</h2> section
4. Include multiple sections with h2 and h3 headings
5. Use paragraphs, lists, and emphasis appropriately
6. Write in a clear, engaging, and educational tone suitable for high school students
7. Make it comprehensive but readable (aim for 800-1500 words)
8. Include practical tips, examples, and actionable advice
9. Use proper HTML structure with headings, paragraphs, and lists
10. Do not include any markdown formatting - use HTML tags only

Format the response as clean HTML that can be directly inserted into a rich text editor.`;

    // Try gemini-2.5-pro models first (as requested), with fallbacks
    let model = 'gemini-2.5-pro';
    let result;
    let lastError: any = null;
    
    // Try different model variants
    const modelVariants = [
      'gemini-2.5-pro',
      'gemini-2.5-pro-exp',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash'
    ];
    
    for (const modelVariant of modelVariants) {
      try {
        model = modelVariant;
        result = await client.models.generateContent({
          model: model,
          config: {
            temperature: 0.8,
            topP: 0.95,
            maxOutputTokens: 8192,
            systemInstruction: {
              parts: [{ text: 'You are an expert content writer specializing in educational blog posts for high school students preparing for standardized tests.' }]
            }
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        console.log(`Successfully used model: ${model}`);
        break; // Success, exit loop
      } catch (error: any) {
        lastError = error;
        // If it's a 404 or "not found", try next model
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          console.log(`${model} not available, trying next model...`);
          continue;
        } else {
          // For other errors, throw immediately
          throw error;
        }
      }
    }
    
    // If we exhausted all models, throw the last error
    if (!result) {
      throw lastError || new Error('Failed to generate content with any available model');
    }

    // Robust text extraction for @google/genai SDK
    let responseText = '';
    
    // Try getting text directly if available (newer SDK versions)
    if (typeof (result as any).text === 'function') {
        try { responseText = (result as any).text(); } catch {}
    } else if (typeof (result as any).text === 'string') {
        responseText = (result as any).text;
    }

    // Try extracting from candidates if text() didn't work
    if (!responseText && (result as any).candidates?.[0]?.content?.parts?.[0]?.text) {
        responseText = (result as any).candidates[0].content.parts[0].text;
    }
    
    // Fallback: check nested response object (legacy structure in some versions)
    if (!responseText && (result as any).response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        responseText = (result as any).response.candidates[0].content.parts[0].text;
    }

    if (!responseText) {
        console.error('Gemini response structure:', JSON.stringify(result, null, 2));
        throw new Error('No text in response');
    }

    // Extract title if not provided
    let generatedTitle = title;
    if (!title && topic) {
      // Try to extract a title from the response or generate one
      const titlePrompt = `Based on this topic: "${topic}", generate a catchy, engaging blog post title (just the title, no quotes or extra text).`;
      try {
        const titleResult = await client.models.generateContent({
          model: model, // Use the same model as content generation
          contents: [{ role: 'user', parts: [{ text: titlePrompt }] }]
        });
        
        let titleText = '';
        if (typeof (titleResult as any).text === 'function') {
          try { titleText = (titleResult as any).text(); } catch {}
        } else if (typeof (titleResult as any).text === 'string') {
          titleText = (titleResult as any).text;
        }
        if (!titleText && (titleResult as any).candidates?.[0]?.content?.parts?.[0]?.text) {
          titleText = (titleResult as any).candidates[0].content.parts[0].text;
        }
        if (titleText) {
          generatedTitle = titleText.trim().replace(/^["']|["']$/g, '');
        }
      } catch (error) {
        console.warn('Failed to generate title:', error);
      }
    }

    return NextResponse.json({ 
      content: responseText.trim(),
      title: generatedTitle || null
    });
  } catch (error: any) {
    console.error('Error calling Gemini for blog autofill:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate blog content' },
      { status: 500 }
    );
  }
}
