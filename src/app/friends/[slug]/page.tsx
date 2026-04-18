import FriendProfileClient from './FriendProfileClient';

export function generateStaticParams() {
  // Return at least one entry for static export compatibility
  // Other slugs will work via client-side navigation
  return [{ slug: 'placeholder' }];
}

export default function FriendProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  return <FriendProfileClient />;
}
