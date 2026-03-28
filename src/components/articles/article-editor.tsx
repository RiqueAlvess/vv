'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApi } from '@/hooks/use-api';
import { useNotifications } from '@/hooks/use-notifications';
import { ArrowLeft, Save } from 'lucide-react';
import React from 'react';

interface ArticleEditorProps {
  mode: 'create' | 'edit';
  articleId?: string;
}

// ── Rich text toolbar editor ────────────────────────────────────────────────
interface ToolbarEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function ToolbarEditor({ value, onChange, placeholder }: ToolbarEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  // Insert text at cursor position
  const insert = (before: string, after = '', placeholder = '') => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const newValue =
      value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newValue);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(
        start + before.length,
        start + before.length + selected.length
      );
    }, 0);
  };

  // Wrap line(s) with prefix
  const insertLine = (prefix: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newValue);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  // Insert image markdown
  const insertImage = () => {
    const url = window.prompt('URL da imagem:');
    if (!url) return;
    const alt = window.prompt('Texto alternativo (opcional):') || 'imagem';
    const ta = ref.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const md = `\n![${alt}](${url})\n`;
    onChange(value.slice(0, pos) + md + value.slice(pos));
  };

  // Insert video embed (YouTube/Vimeo iframe)
  const insertVideo = () => {
    const url = window.prompt('URL do video (YouTube ou Vimeo):');
    if (!url) return;

    let embedUrl = url;
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;

    const ta = ref.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const md = `\n<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>\n`;
    onChange(value.slice(0, pos) + md + value.slice(pos));
  };

  // Insert link
  const insertLink = () => {
    const ta = ref.current;
    if (!ta) return;
    const selected = value.slice(ta.selectionStart, ta.selectionEnd);
    const text = selected || window.prompt('Texto do link:') || 'link';
    const url = window.prompt('URL:');
    if (!url) return;
    insert(`[${text}](${url})`, '', '');
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/<iframe[^>]*>.*?<\/iframe>/gs, (match) => match)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
        '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:8px 0" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:underline">$1</a>')
      .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:1rem 0 0.4rem">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:1.2rem;font-weight:700;margin:1.4rem 0 0.6rem">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:1.5rem;font-weight:800;margin:1.4rem 0 0.6rem">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:0 4px;border-radius:3px;font-family:monospace;font-size:0.85em">$1</code>')
      .replace(/^---$/gm, '<hr style="margin:1rem 0;border-color:#e2e8f0"/>')
      .replace(/^- (.+)$/gm, '<li style="margin-left:1.5rem;list-style:disc;margin-bottom:2px">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1.5rem;list-style:decimal;margin-bottom:2px">$1</li>')
      .replace(/\n/g, '<br/>');
  };

  const tools: {
    label: string;
    title: string;
    action: () => void;
    icon: React.ReactNode;
  }[] = [
    {
      label: 'B', title: 'Negrito (Ctrl+B)',
      icon: <strong>B</strong>,
      action: () => insert('**', '**', 'texto em negrito'),
    },
    {
      label: 'I', title: 'Italico (Ctrl+I)',
      icon: <em>I</em>,
      action: () => insert('*', '*', 'texto em italico'),
    },
    {
      label: 'H1', title: 'Titulo 1',
      icon: <span className="font-bold text-xs">H1</span>,
      action: () => insertLine('# '),
    },
    {
      label: 'H2', title: 'Titulo 2',
      icon: <span className="font-bold text-xs">H2</span>,
      action: () => insertLine('## '),
    },
    {
      label: 'H3', title: 'Titulo 3',
      icon: <span className="font-bold text-xs">H3</span>,
      action: () => insertLine('### '),
    },
    {
      label: '—', title: 'Separador',
      icon: <span className="text-sm font-bold">—</span>,
      action: () => {
        const ta = ref.current;
        if (!ta) return;
        const pos = ta.selectionStart;
        onChange(value.slice(0, pos) + '\n---\n' + value.slice(pos));
      },
    },
    {
      label: 'Lista', title: 'Lista',
      icon: (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
          <rect x="5" y="4" width="10" height="1.5" rx="0.75"/>
          <rect x="5" y="7.5" width="10" height="1.5" rx="0.75"/>
          <rect x="5" y="11" width="10" height="1.5" rx="0.75"/>
          <circle cx="2" cy="4.75" r="1"/>
          <circle cx="2" cy="8.25" r="1"/>
          <circle cx="2" cy="11.75" r="1"/>
        </svg>
      ),
      action: () => insertLine('- '),
    },
    {
      label: 'Code', title: 'Codigo inline',
      icon: <span className="font-mono text-xs">{'<>'}</span>,
      action: () => insert('`', '`', 'codigo'),
    },
    {
      label: 'Link', title: 'Inserir link',
      icon: (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5L7.5 3.5"/>
          <path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5L8.5 12.5"/>
        </svg>
      ),
      action: insertLink,
    },
    {
      label: 'Img', title: 'Inserir imagem por URL',
      icon: (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="3" width="14" height="10" rx="1.5"/>
          <circle cx="5.5" cy="6.5" r="1"/>
          <path d="M1 11l4-3.5 3 2.5 2.5-2 3.5 3"/>
        </svg>
      ),
      action: insertImage,
    },
    {
      label: 'Video', title: 'Incorporar video (YouTube/Vimeo)',
      icon: (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="3" width="14" height="10" rx="1.5"/>
          <polygon fill="currentColor" stroke="none" points="6,5.5 11,8 6,10.5"/>
        </svg>
      ),
      action: insertVideo,
    },
  ];

  return (
    <div className="rounded-md border overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-muted/50 border-b flex-wrap">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.title}
            onClick={tool.action}
            className="flex items-center justify-center w-7 h-7 rounded text-sm text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm transition-all"
          >
            {tool.icon}
          </button>
        ))}
        <div className="flex-1" />
        {/* Write / Preview tabs */}
        <div className="flex rounded-md border bg-background overflow-hidden">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={`px-3 py-1 text-xs transition-colors ${
              tab === 'write'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Escrever
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-3 py-1 text-xs transition-colors ${
              tab === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {tab === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[420px] p-4 font-mono text-sm resize-y bg-background focus:outline-none"
        />
      ) : (
        <div
          className="min-h-[420px] p-4 text-sm leading-relaxed bg-background overflow-auto"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
      )}
    </div>
  );
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/articles')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">
          {mode === 'create' ? 'Novo Artigo' : 'Editar Artigo'}
        </h1>
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
            <Label>Conteudo</Label>
            <ToolbarEditor
              value={content}
              onChange={setContent}
              placeholder={`Escreva o conteudo aqui...

# Titulo Principal
## Subtitulo

Paragrafo com **negrito** e *italico*.

- Item da lista
- Outro item`}
            />
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
