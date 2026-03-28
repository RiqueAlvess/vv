'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { useNotifications } from '@/hooks/use-notifications';
import { ArrowLeft, Save, Eye } from 'lucide-react';

interface ArticleEditorProps {
  mode: 'create' | 'edit';
  articleId?: string;
}

export function ArticleEditor({ mode, articleId }: ArticleEditorProps) {
  const { get, post, put } = useApi();
  const { success, error: notifyError } = useNotifications();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [pinned, setPinned] = useState(false);
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [coverError, setCoverError] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && articleId) {
      get(`/api/articles/${articleId}`)
        .then(r => r.json())
        .then(data => {
          setTitle(data.title ?? '');
          setContent(data.content ?? '');
          setCoverUrl(data.cover_url ?? '');
          setPinned(data.pinned ?? false);
          setPublished(data.published ?? true);
        });
    }
  }, [mode, articleId, get]);

  const handleSave = async () => {
    if (!title.trim()) { notifyError('Título é obrigatório'); return; }
    if (!content.trim()) { notifyError('Conteúdo é obrigatório'); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        cover_url: coverUrl.trim() || null,
        pinned,
        published,
      };

      if (mode === 'create') {
        await post('/api/articles', payload);
        success('Artigo criado');
      } else {
        await put(`/api/articles/${articleId}`, payload);
        success('Artigo atualizado');
      }
      router.push('/articles');
    } catch {
      notifyError('Erro ao salvar artigo');
    } finally {
      setSaving(false);
    }
  };

  // Simple markdown renderer
  const renderMarkdown = (text: string) =>
    text
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/\n/g, '<br/>');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/articles')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">
          {mode === 'create' ? 'Novo Artigo' : 'Editar Artigo'}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreview(p => !p)}
        >
          <Eye className="h-4 w-4 mr-1.5" />
          {preview ? 'Editor' : 'Preview'}
        </Button>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título do artigo..."
              className="text-base font-medium h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Conteúdo</span>
              <span className="text-xs text-muted-foreground font-normal">
                Suporta **negrito**, *itálico*, # Titulo, - lista
              </span>
            </Label>
            {preview ? (
              <div
                className="min-h-[400px] rounded-md border p-4 prose prose-sm max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            ) : (
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Escreva o conteúdo do artigo aqui...

# Título Principal
## Subtítulo

Parágrafo com **negrito** e *itálico*.

- Item da lista
- Outro item"
                className="min-h-[400px] font-mono text-sm resize-y"
              />
            )}
          </div>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configurações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="published" className="text-sm cursor-pointer">
                  Publicado
                </Label>
                <Switch
                  id="published"
                  checked={published}
                  onCheckedChange={setPublished}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="pinned" className="text-sm cursor-pointer">
                  Fixar no topo
                </Label>
                <Switch
                  id="pinned"
                  checked={pinned}
                  onCheckedChange={setPinned}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Imagem de Capa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={coverUrl}
                onChange={e => { setCoverUrl(e.target.value); setCoverError(false); }}
                placeholder="https://exemplo.com/imagem.jpg"
                className="text-xs"
              />
              {coverUrl && !coverError && (
                <div className="rounded-md overflow-hidden border">
                  <img
                    src={coverUrl}
                    alt="Preview da capa"
                    className="w-full h-32 object-cover"
                    onError={() => setCoverError(true)}
                  />
                </div>
              )}
              {coverError && (
                <p className="text-xs text-destructive">URL da imagem inválida</p>
              )}
              {!coverUrl && (
                <p className="text-xs text-muted-foreground">
                  Cole uma URL de imagem para usar como capa
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
