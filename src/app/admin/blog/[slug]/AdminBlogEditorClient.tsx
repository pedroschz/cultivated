"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { BlogPost, getPostAdmin, saveBlogPost } from "@/lib/blog-service";
import TipTapEditor from "@/components/blog/TipTapEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2, Eye, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebaseClient";

export default function AdminBlogEditorClient({ slug }: { slug: string }) {
  const router = useRouter();
  const isNew = slug === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillTopic, setAutofillTopic] = useState("");
  const [autofillTitle, setAutofillTitle] = useState("");
  
  const [post, setPost] = useState<Partial<BlogPost>>({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    status: "draft",
    category: "Math",
    author: "CultivatED Team",
    readTime: "5 min read",
    coverImage: ""
  });

  useEffect(() => {
    if (!isNew) {
      loadPost();
    }
  }, [slug]);

  const loadPost = async () => {
    const data = await getPostAdmin(slug);
    if (data) {
      setPost(data);
    } else {
      toast.error("Post not found");
      router.push("/admin/blog");
    }
    setLoading(false);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    // Only auto-generate slug if it's a new post or slug hasn't been manually edited (simple heuristic)
    if (isNew && (!post.slug || post.slug === generateSlug(post.title || ""))) {
       setPost(prev => ({ ...prev, title, slug: generateSlug(title) }));
    } else {
       setPost(prev => ({ ...prev, title }));
    }
  };

  const handleSave = async () => {
    if (!post.title || !post.slug || !post.content) {
      toast.error("Please fill in all required fields (Title, Slug, Content)");
      return;
    }

    setSaving(true);
    try {
      await saveBlogPost(post as BlogPost);
      toast.success("Post saved successfully");
      if (isNew) {
        router.replace(`/admin/blog/${post.slug}`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save post");
    } finally {
      setSaving(false);
    }
  };

  const handleAutofill = async () => {
    if (!autofillTopic.trim() && !autofillTitle.trim()) {
      toast.error("Please enter a topic or title");
      return;
    }

    setAutofilling(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch("/api/blog/autofill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          topic: autofillTopic.trim() || undefined,
          title: autofillTitle.trim() || undefined,
          category: post.category,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate content");
      }

      const data = await response.json();
      
      // Update content
      if (data.content) {
        setPost(prev => ({ ...prev, content: data.content }));
      }
      
      // Update title if generated and not already set
      if (data.title && !post.title) {
        setPost(prev => {
          const newTitle = data.title;
          return {
            ...prev,
            title: newTitle,
            slug: generateSlug(newTitle),
          };
        });
      }
      
      toast.success("Content generated successfully! Review and edit as needed.");
      setAutofillOpen(false);
      setAutofillTopic("");
      setAutofillTitle("");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to generate content");
    } finally {
      setAutofilling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen ambient-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen ambient-bg pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/admin/blog">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <h1 className="font-display font-bold text-lg">
                {isNew ? "Create New Post" : "Edit Post"}
              </h1>
              {!isNew && (
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                  post.status === 'published' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                )}>
                  {post.status}
                </span>
              )}
           </div>
           
           <div className="flex items-center gap-2">
              {!isNew && (
                <Button variant="outline" asChild>
                  <Link href={`/blog/${post.slug}`} target="_blank">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Link>
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Post
              </Button>
           </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Main Editor */}
         <div className="lg:col-span-2 space-y-6">
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                  <Label htmlFor="title">Post Title</Label>
                  <Dialog open={autofillOpen} onOpenChange={setAutofillOpen}>
                     <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                           AI Autofill
                        </Button>
                     </DialogTrigger>
                     <DialogContent>
                        <DialogHeader>
                           <DialogTitle>AI Content Generator</DialogTitle>
                           <DialogDescription>
                              Generate blog post content using AI. Enter a topic or title, and we'll create the content for you.
                           </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                           <div className="space-y-2">
                              <Label htmlFor="autofill-topic">Topic (optional if title provided)</Label>
                              <Input
                                 id="autofill-topic"
                                 value={autofillTopic}
                                 onChange={(e) => setAutofillTopic(e.target.value)}
                                 placeholder="e.g., SAT math strategies, study tips, college prep..."
                                 disabled={autofilling}
                              />
                           </div>
                           <div className="space-y-2">
                              <Label htmlFor="autofill-title">Title (optional if topic provided)</Label>
                              <Input
                                 id="autofill-title"
                                 value={autofillTitle}
                                 onChange={(e) => setAutofillTitle(e.target.value)}
                                 placeholder="e.g., How to Ace the SAT Math Section"
                                 disabled={autofilling}
                              />
                           </div>
                        </div>
                        <DialogFooter>
                           <Button
                              variant="outline"
                              onClick={() => {
                                 setAutofillOpen(false);
                                 setAutofillTopic("");
                                 setAutofillTitle("");
                              }}
                              disabled={autofilling}
                           >
                              Cancel
                           </Button>
                           <Button onClick={handleAutofill} disabled={autofilling}>
                              {autofilling ? (
                                 <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                 </>
                              ) : (
                                 <>
                                    Generate Content
                                 </>
                              )}
                           </Button>
                        </DialogFooter>
                     </DialogContent>
                  </Dialog>
               </div>
               <Input 
                 id="title" 
                 value={post.title} 
                 onChange={handleTitleChange} 
                 placeholder="Enter a catchy title..."
                 className="text-lg font-bold"
               />
            </div>
            
            <div className="space-y-2">
               <Label>Content</Label>
               <TipTapEditor 
                 content={post.content || ""} 
                 onChange={(html) => setPost(prev => ({ ...prev, content: html }))} 
               />
            </div>

            <div className="space-y-2">
               <Label htmlFor="excerpt">Excerpt</Label>
               <Textarea 
                 id="excerpt" 
                 value={post.excerpt} 
                 onChange={(e) => setPost(prev => ({ ...prev, excerpt: e.target.value }))}
                 placeholder="Short summary for preview cards..."
                 rows={3}
               />
            </div>
         </div>

         {/* Sidebar Settings */}
         <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
               <h3 className="font-bold text-lg">Post Settings</h3>
               
               <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  <Input 
                    id="slug" 
                    value={post.slug} 
                    onChange={(e) => setPost(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="my-post-slug"
                    className="font-mono text-sm"
                  />
               </div>

               <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={post.status} 
                    onValueChange={(val: any) => setPost(prev => ({ ...prev, status: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
               </div>

               <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={post.category} 
                    onValueChange={(val) => setPost(prev => ({ ...prev, category: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Math">Math</SelectItem>
                      <SelectItem value="Reading & Writing">Reading & Writing</SelectItem>
                      <SelectItem value="News">News</SelectItem>
                      <SelectItem value="Study Tips">Study Tips</SelectItem>
                    </SelectContent>
                  </Select>
               </div>

               <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input 
                    id="author" 
                    value={post.author} 
                    onChange={(e) => setPost(prev => ({ ...prev, author: e.target.value }))}
                  />
               </div>

               <div className="space-y-2">
                  <Label htmlFor="readTime">Read Time</Label>
                  <Input 
                    id="readTime" 
                    value={post.readTime} 
                    onChange={(e) => setPost(prev => ({ ...prev, readTime: e.target.value }))}
                    placeholder="e.g. 5 min read"
                  />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
