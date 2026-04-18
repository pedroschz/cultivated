"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllPostsAdmin, deleteBlogPost, BlogPost } from "@/lib/blog-service";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    const data = await getAllPostsAdmin();
    setPosts(data);
    setLoading(false);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      await deleteBlogPost(slug);
      toast.success("Post deleted successfully");
      loadPosts();
    } catch (error) {
      toast.error("Failed to delete post");
    }
  };

  return (
    <div className="min-h-screen ambient-bg">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
             <h1 className="text-3xl font-display font-bold mb-2">Blog Manager</h1>
             <p className="text-muted-foreground">Create and manage blog posts.</p>
          </div>
          <Button asChild>
            <Link href="/admin/blog/new">
              <Plus className="w-4 h-4 mr-2" />
              New Post
            </Link>
          </Button>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="p-12 text-center">
               <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Edit className="w-8 h-8 text-muted-foreground" />
               </div>
               <h3 className="text-lg font-bold mb-2">No posts yet</h3>
               <p className="text-muted-foreground mb-6">Create your first blog post to get started.</p>
               <Button asChild>
                <Link href="/admin/blog/new">
                  Create Post
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {posts.map((post) => (
                <div key={post.slug} className="p-6 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-muted/30 transition-colors group">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       {post.status === 'published' ? (
                          <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Published</span>
                       ) : (
                          <span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Draft</span>
                       )}
                       <span className="text-xs text-muted-foreground font-medium">
                          {post.updatedAt ? format(post.updatedAt, 'MMM d, yyyy') : 'Unknown date'}
                       </span>
                       <span className="text-xs text-muted-foreground font-medium">•</span>
                       <span className="text-xs text-muted-foreground font-medium">{post.category}</span>
                    </div>
                    <h3 className="font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{post.excerpt}</p>
                  </div>
                  
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {post.status === 'published' && (
                       <Button variant="ghost" size="icon" asChild title="View Live">
                          <Link href={`/blog/${post.slug}`} target="_blank">
                             <ExternalLink className="w-4 h-4 text-muted-foreground" />
                          </Link>
                       </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/blog/${post.slug}`}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Link>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(post.slug)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
