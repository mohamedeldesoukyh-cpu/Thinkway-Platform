import { redirect } from 'next/navigation';

/** Preserve old bookmarks while using the single supported posting workflow. */
export default function PostingCenterPage() {
  redirect('/finance/post-to-accounting');
}
