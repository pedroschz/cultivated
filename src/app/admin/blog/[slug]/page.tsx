import { use } from "react";
import AdminBlogEditorClient from "./AdminBlogEditorClient";

export function generateStaticParams() {
  // Return at least the "new" route for static export
  // Other slugs will work via client-side navigation
  return [{ slug: "new" }];
}

export default function AdminBlogEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <AdminBlogEditorClient slug={slug} />;
}
