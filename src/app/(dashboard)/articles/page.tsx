'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pin, PinOff, Pencil, Trash2, Plus, Eye, EyeOff, BookOpen } from 'lucide-react';
import { ConfirmModal } from '@/components/modals/confirm-modal';

interface Article {
  id: string; title: string; slug: string; content: string;
  cover_url: string | null; pinned: boolean; published: boolean;
  created_at: string; author: { name: string };
}

export default function ArticlesPage() {
  const { get, put, del } = useApi();
  const { user } = useAuth();
  const { success, error: notifyError } = useNotifications();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isADM = user?.role === 'ADM';

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/articles?limit=50');
      if (res.ok) {
        const data = await res.json();
        setArticles(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const togglePin = async (article: Article) => {
    try {
      await put(`/api/articles/${article.id}`, { pinned: !article.pinned });
      setArticles(prev => prev.map(a =>
        a.id === article.id ? { ...a, pinned: !a.pinned } : a
      ).sort((a, b) => Number(b.pinned) - Number(a.pinned)));
      success(article.pinned ? 'Artigo desafixado' : 'Artigo fixado no topo');
    } catch { notifyError('Erro ao atualizar'); }
  };

  const togglePublish = async (article: Article) => {
    try {
      await put(`/api/articles/${article.id}`, { published: !article.published });
      setArticles(prev => prev.map(a =>
        a.id === article.id ? { ...a, published: !a.published } : a
      ));
      success(article.published ? 'Artigo despublicado' : 'Artigo publicado');
    } catch { notifyError('Erro ao atualizar'); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await del(`/api/articles/${deleteId}`);
      setArticles(prev => prev.filter(a => a.id !== deleteId));
      success('Artigo excluído');
      setDeleteId(null);
    } catch { notifyError('Erro ao excluir'); }
    finally { setDeleting(false); }
  };

  const preview = (content: string) =>
    content.replace(/[#*_\[\]]/g, '').slice(0, 120) + (content.length > 120 ? '...' : '');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Base de Conhecimento</h1>
          <p className="text-muted-foreground">Artigos e orientações sobre riscos psicossociais</p>
        </div>
        {isADM && (
          <Button onClick={() => router.push('/articles/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Artigo
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium">Nenhum artigo publicado</h3>
            {isADM && (
              <Button className="mt-4" onClick={() => router.push('/articles/new')}>
                Criar primeiro artigo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map(article => (
            <Card
              key={article.id}
              className={`overflow-hidden flex flex-col transition-shadow hover:shadow-md cursor-pointer ${
                !article.published && isADM ? 'opacity-60 border-dashed' : ''
              }`}
              onClick={() => router.push(`/articles/${article.id}`)}
            >
              {/* Cover image */}
              {article.cover_url ? (
                <div
                  className="h-40 bg-cover bg-center bg-muted shrink-0"
                  style={{ backgroundImage: `url('${article.cover_url}')` }}
                />
              ) : (
                <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0">
                  <BookOpen className="h-10 w-10 text-primary/30" />
                </div>
              )}

              <CardContent className="flex-1 flex flex-col p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {article.pinned && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                        Fixado
                      </Badge>
                    )}
                    {!article.published && isADM && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Rascunho
                      </Badge>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">
                  {article.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-3">
                  {preview(article.content)}
                </p>

                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(article.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>

                  {isADM && (
                    <div
                      className="flex gap-0.5"
                      onClick={e => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7"
                        title={article.pinned ? 'Desafixar' : 'Fixar'}
                        onClick={() => togglePin(article)}
                      >
                        {article.pinned
                          ? <PinOff className="h-3.5 w-3.5" />
                          : <Pin className="h-3.5 w-3.5" />
                        }
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7"
                        title={article.published ? 'Despublicar' : 'Publicar'}
                        onClick={() => togglePublish(article)}
                      >
                        {article.published
                          ? <EyeOff className="h-3.5 w-3.5" />
                          : <Eye className="h-3.5 w-3.5" />
                        }
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7"
                        onClick={() => router.push(`/articles/${article.id}/edit`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(article.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir Artigo"
        description="Deseja realmente excluir este artigo? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
