import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { BlogCard } from "@/components/blog/BlogCard";
import { getPublishedPosts } from "@/lib/blog-service";
import { Metadata } from "next";

export const revalidate = 3600; // Revalidate every hour

export const metadata: Metadata = {
  title: "Blog",
  description: "Latest updates, strategies, and tips for SAT prep.",
};

export default async function BlogPage() {
  const posts = await getPublishedPosts();
  
  const featuredPost = posts.length > 0 ? posts[0] : null;
  const remainingPosts = posts.length > 1 ? posts.slice(1) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      <LandingNavbar />
      
      <main className="flex-1 pt-32 pb-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-16 text-center max-w-2xl mx-auto space-y-4">
             <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-foreground">
               CultivatED Blog
             </h1>
             <p className="text-xl text-muted-foreground leading-relaxed">
               Expert tips, study strategies, and updates to help you crush the SAT.
             </p>
          </div>

          {posts.length === 0 ? (
             <div className="text-center py-20 bg-muted/30 rounded-3xl">
                <p className="text-xl text-muted-foreground">No posts published yet. Check back soon!</p>
             </div>
          ) : (
            <>
              {/* Featured Post */}
              {featuredPost && (
                <section className="mb-16">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-2 h-8 bg-primary rounded-full"/>
                    Featured Story
                  </h2>
                  <BlogCard post={featuredPost} featured={true} />
                </section>
              )}

              {/* Recent Posts Grid */}
              {remainingPosts.length > 0 && (
                <section>
                   <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-2 h-8 bg-muted rounded-full"/>
                    Recent Posts
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {remainingPosts.map((post) => (
                      <BlogCard key={post.slug} post={post} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
