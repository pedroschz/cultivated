import { db } from "@/lib/firebaseClient";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  setDoc, 
  deleteDoc,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
// @ts-ignore
import { getStorage } from "firebase/storage";

// Mock data for build time to prevent Firebase errors during static generation
const MOCK_POSTS: BlogPost[] = [
  {
    slug: "example-post",
    title: "Example Post",
    excerpt: "This is a placeholder post for build time generation.",
    content: "<p>Content</p>",
    author: "Admin",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "published",
    category: "General",
    readTime: "5 min"
  }
];

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string; // HTML content
  coverImage?: string;
  author: string;
  publishedAt?: number; // timestamp in milliseconds
  createdAt: number; // timestamp in milliseconds
  updatedAt: number; // timestamp in milliseconds
  status: 'draft' | 'published';
  category: string;
  readTime: string;
}

const COLLECTION_NAME = 'blog_posts';

/**
 * Fetch all published blog posts for public display
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as BlogPost);
  } catch (error) {
    console.error("Error fetching published posts:", error);
    return [];
  }
}

/**
 * Fetch a single published post by slug
 */
export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, slug);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as BlogPost;
      if (data.status === 'published') {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error fetching post ${slug}:`, error);
    return null;
  }
}

/**
 * Fetch related published posts
 */
export async function getRelatedPublishedPosts(currentSlug: string, category: string): Promise<BlogPost[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('status', '==', 'published'),
      where('category', '==', category),
      limit(4) // Fetch slightly more to filter out current
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => doc.data() as BlogPost)
      .filter(post => post.slug !== currentSlug)
      .slice(0, 3);
  } catch (error) {
    console.error("Error fetching related posts:", error);
    return [];
  }
}

// --- Admin Functions ---

/**
 * Fetch all posts (drafts and published) for admin dashboard
 */
export async function getAllPostsAdmin(): Promise<BlogPost[]> {
  try {
    // Admin query - order by updated recently
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('updatedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as BlogPost);
  } catch (error) {
    console.error("Error fetching admin posts:", error);
    return [];
  }
}

/**
 * Fetch a single post (draft or published) for admin editor
 */
export async function getPostAdmin(slug: string): Promise<BlogPost | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, slug);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as BlogPost;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching admin post ${slug}:`, error);
    return null;
  }
}

/**
 * Save or update a blog post
 */
export async function saveBlogPost(post: Partial<BlogPost> & { slug: string }): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, post.slug);
    const now = Date.now();
    
    const postData = {
      ...post,
      updatedAt: now,
      // If it's a new post (no createdAt), set it
      createdAt: post.createdAt || now,
    };

    // If publishing for the first time, set publishedAt
    if (post.status === 'published' && !post.publishedAt) {
      postData.publishedAt = now;
    }

    await setDoc(docRef, postData, { merge: true });
  } catch (error) {
    console.error("Error saving blog post:", error);
    throw error;
  }
}

/**
 * Delete a blog post
 */
export async function deleteBlogPost(slug: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, slug));
  } catch (error) {
    console.error("Error deleting blog post:", error);
    throw error;
  }
}
