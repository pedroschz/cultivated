
import * as dotenv from 'dotenv';
// Load environment variables before other imports
dotenv.config({ path: '.env.local' });
dotenv.config();

import { db } from '../src/lib/firebaseAdmin';
import { postsPart1 } from './data/posts-part1';
import { postsPart2 } from './data/posts-part2';
import { postsPart3 } from './data/posts-part3';

const allPosts = [
  ...postsPart1,
  ...postsPart2,
  ...postsPart3
];

async function seedBlogPosts() {
  console.log(`Starting seed of ${allPosts.length} EXTENDED blog posts...`);
  
  for (const post of allPosts) {
    const now = Date.now();
    
    // We want to keep the "publishedAt" recent but slightly staggered so they don't all look identical
    // Random stagger within the last 24 hours
    const stagger = Math.floor(Math.random() * 86400000); 
    const publishedTime = now - stagger;

    const postData = {
      ...post,
      createdAt: publishedTime, // Pretend it was created then
      updatedAt: now,
      publishedAt: publishedTime,
    };

    try {
      await db.collection('blog_posts').doc(post.slug).set(postData, { merge: true });
      console.log(`✅ Seeded/Updated: ${post.title}`);
    } catch (error) {
      console.error(`❌ Error seeding ${post.title}:`, error);
    }
  }

  console.log('Seeding complete! You may need to wait up to an hour for the deployed site to update due to ISR, or trigger a redeploy.');
  process.exit(0);
}

seedBlogPosts().catch(err => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
