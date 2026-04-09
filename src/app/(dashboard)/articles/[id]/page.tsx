'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Pencil, Pin } from 'lucide-react';

interface Article {
  id: string; title: string; content: string; cover_url: string | null;
  pinned: boolean; published: boolean; created_at: string;
  author: { name: string };
}

export default function ArticleViewPage() {
  const { id } = useParams();
  const { get } = useApi();
  const { user } = useAuth();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get(`/api/articles/${id}`)
      .then(r => r.json())
      .then(data => { setArticle(data); setLoading(false); })
      .catch(() => { router.push('/articles'); });
  }, [id, get, router]);

  const renderMarkdown = (text: string) =>
    text
      .replace(/<iframe[^>]*>.*?<\/iframe>/gs, (match) => match)
      .replace(/!\[([^\]]*)\]\(((?:[^)(]|\([^)]*\))+)\)/g,
        '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:12px 0;display:block" />')
      .replace(/\[([^\]]+)\]\(((?:[^)(]|\([^)]*\))+)\)/g,
        '<a href="$2" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:underline">$1</a>')
      .replace(/^### (.+)$/gm,
        '<h3 style="font-size:1rem;font-weight:600;margin:1.2rem 0 0.4rem">$1</h3>')
      .replace(/^## (.+)$/gm,
        '<h2 style="font-size:1.2rem;font-weight:700;margin:1.5rem 0 0.6rem">$1</h2>')
      .replace(/^# (.+)$/gm,
        '<h1 style="font-size:1.5rem;font-weight:800;margin:1.5rem 0 0.6rem">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g,
        '<code style="background:#f1f5f9;padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.85em">$1</code>')
      .replace(/^---$/gm, '<hr style="margin:1.5rem 0;border-color:#e2e8f0"/>')
      .replace(/^- (.+)$/gm,
        '<li style="margin-left:1.5rem;list-style:disc;margin-bottom:3px">$1</li>')
      .replace(/^\d+\. (.+)$/gm,
        '<li style="margin-left:1.5rem;list-style:decimal;margin-bottom:3px">$1</li>')
      .replace(/\n/g, '<br/>');

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-96 w-full" />
    </div>
  );

  if (!article) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/articles')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2 flex-1">
          {article.pinned && <Badge variant="secondary"><Pin className="h-3 w-3 mr-1" />Fixado</Badge>}
          {!article.published && <Badge variant="outline">Rascunho</Badge>}
        </div>
        {user?.role === 'ADM' && (
          <Button variant="outline" size="sm" onClick={() => router.push(`/articles/${id}/edit`)}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Editar
          </Button>
        )}
      </div>

      {article.cover_url && (
        <div className="rounded-xl overflow-hidden border">
          <img
            src={article.cover_url}
            alt={article.title}
            className="w-full h-56 object-cover"
          />
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Por {article.author.name} — {format(new Date(article.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div
        className="text-sm leading-relaxed text-foreground/90"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
      />
    </div>
  );
}
