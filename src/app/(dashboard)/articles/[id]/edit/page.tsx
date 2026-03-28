'use client';
import { useParams } from 'next/navigation';
import { ArticleEditor } from '@/components/articles/article-editor';

export default function EditArticlePage() {
  const { id } = useParams();
  return <ArticleEditor mode="edit" articleId={id as string} />;
}
