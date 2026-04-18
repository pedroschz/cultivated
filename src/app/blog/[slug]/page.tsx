import { notFound } from "next/navigation";
import { getPublishedPostBySlug, getRelatedPublishedPosts, getPublishedPosts } from "@/lib/blog-service";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { BlogCard } from "@/components/blog/BlogCard";
import Link from "next/link";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { Metadata } from "next";
import { format } from "date-fns";
import { APP_NAME, WEB_BASE_URL } from "@/lib/config";

export const revalidate = 3600; // Revalidate every hour

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  try {
    // Fetch all published posts at build time
    const posts = await getPublishedPosts();
    return posts.map((post) => ({
      slug: post.slug,
    }));
  } catch (error) {
    // If we can't fetch posts at build time (e.g., Firebase not initialized),
    // return empty array - posts will still work via client-side navigation
    console.warn("Could not fetch blog posts at build time:", error);
    return [];
  }
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) {
    return {
      title: "Post Not Found",
    };
  }
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: new Date(post.publishedAt || post.createdAt).toISOString(),
      authors: [post.author],
      images: post.coverImage ? [post.coverImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPublishedPosts(post.slug, post.category);

  // Format date safely
  const formattedDate = post.publishedAt 
    ? format(post.publishedAt, 'MMM d, yyyy') 
    : format(post.createdAt || Date.now(), 'MMM d, yyyy');

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.excerpt,
            image: post.coverImage || `${WEB_BASE_URL}/logo.png`,
            datePublished: new Date(post.publishedAt || post.createdAt).toISOString(),
            dateModified: new Date(post.updatedAt || post.createdAt).toISOString(),
            author: {
              "@type": "Person",
              name: post.author,
            },
            publisher: {
              "@type": "Organization",
              name: APP_NAME,
              logo: {
                "@type": "ImageObject",
                url: `${WEB_BASE_URL}/logo.png`,
              },
            },
          }),
        }}
      />
      <LandingNavbar />

      <main className="flex-1 pt-32 pb-24">
        <article className="container mx-auto px-4 md:px-6 max-w-4xl">
           <Link 
             href="/blog" 
             className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary mb-8 transition-colors group"
           >
             <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
             Back to Blog
           </Link>

           <header className="mb-12 text-center space-y-6">
             <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                <span className="text-primary bg-primary/10 px-3 py-1 rounded-full">{post.category}</span>
                <span>•</span>
                <span>{post.readTime}</span>
             </div>
             
             <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-black tracking-tight text-foreground leading-[1.1]">
               {post.title}
             </h1>

             <div className="flex items-center justify-center gap-8 text-muted-foreground">
                <div className="flex items-center gap-2">
                   <User className="w-4 h-4" />
                   <span className="font-medium">{post.author}</span>
                </div>
                <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4" />
                   <span className="font-medium">{formattedDate}</span>
                </div>
             </div>
           </header>

           {/* Content */}
           <div className="prose prose-xl md:prose-2xl dark:prose-invert mx-auto mb-20 prose-headings:font-display prose-headings:font-bold prose-h2:mt-16 prose-h2:mb-8 prose-h3:mt-12 prose-h3:mb-6 prose-p:text-muted-foreground prose-p:leading-loose prose-p:mb-8 prose-p:text-lg md:prose-p:text-xl prose-li:my-2 prose-strong:text-foreground prose-a:text-primary hover:prose-a:text-primary/80">
             <div className="blog-prose-content" dangerouslySetInnerHTML={{ __html: post.content }} />
           </div>
           
           {/* Author Bio */}
           <div className="border-t border-border pt-12 mt-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
                       {post.author.charAt(0)}
                    </div>
                    <div>
                       <div className="font-bold text-lg">Written by {post.author}</div>
                       <div className="text-muted-foreground">SAT Prep Expert at CultivatED</div>
                    </div>
                 </div>
              </div>
           </div>
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="bg-muted/30 py-20 mt-20">
             <div className="container mx-auto px-4 md:px-6">
                <h2 className="text-3xl font-display font-bold mb-12 text-center">Related Articles</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                   {relatedPosts.map(post => (
                      <BlogCard key={post.slug} post={post} />
                   ))}
                </div>
             </div>
          </section>
        )}
      </main>

      <LandingFooter />
    </div>
  );
}
