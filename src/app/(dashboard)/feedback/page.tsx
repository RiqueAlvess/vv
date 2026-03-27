'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-api';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, MessageSquare, CheckCheck, Filter, ExternalLink } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface FeedbackItem {
  id: string; type: string; category: string | null;
  message: string; read: boolean; created_at: string;
}

interface ChannelInfo {
  id: string; public_token: string; public_url: string;
  active: boolean; unread_count: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  positivo: { label: 'Positivo',  color: '#22c55e' },
  negativo: { label: 'Negativo',  color: '#ef4444' },
  sugestao: { label: 'Sugestão',  color: '#3b82f6' },
  outro:    { label: 'Outro',     color: '#94a3b8' },
};

const CATEGORY_LABELS: Record<string, string> = {
  lideranca: 'Liderança', carga_trabalho: 'Carga de Trabalho',
  relacionamentos: 'Relacionamentos', comunicacao: 'Comunicação',
  beneficios: 'Benefícios', ambiente: 'Ambiente', outro: 'Outro',
};

export default function FeedbackPage() {
  const { get, patch } = useApi();
  const { success, error: notifyError } = useNotifications();
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [total, setTotal] = useState(0);

  const fetchChannel = useCallback(async () => {
    try {
      const res = await get('/api/feedback/channel');
      if (res.ok) setChannel(await res.json());
    } catch { /* ignore */ }
  }, [get]);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await get(`/api/feedback/messages?${params}`);
      if (res.ok) {
        const data = await res.json();
        setFeedbacks(data.data);
        setTotal(data.total);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [get, typeFilter]);

  useEffect(() => { fetchChannel(); }, [fetchChannel]);
  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);

  const copyLink = () => {
    if (!channel) return;
    navigator.clipboard.writeText(channel.public_url);
    success('Link copiado!', 'Compartilhe com os colaboradores da empresa');
  };

  const markAsRead = async (feedbackId: string) => {
    try {
      await patch('/api/feedback/messages', { feedback_id: feedbackId, read: true });
      setFeedbacks(prev => prev.map(f => f.id === feedbackId ? { ...f, read: true } : f));
      setChannel(prev => prev ? { ...prev, unread_count: Math.max(0, prev.unread_count - 1) } : prev);
    } catch {
      notifyError('Erro ao marcar como lido');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Canal de Feedback Anônimo</h1>
          <p className="text-muted-foreground">Mensagens enviadas pelos colaboradores</p>
        </div>
        {channel?.unread_count ? (
          <Badge className="bg-primary text-primary-foreground">{channel.unread_count} não lidas</Badge>
        ) : null}
      </div>

      {/* Channel info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Link Público do Canal
          </CardTitle>
          <CardDescription>
            Compartilhe este link com os colaboradores para que possam enviar feedback anonimamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {channel ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono truncate">
                {channel.public_url}
              </code>
              <Button variant="outline" size="sm" onClick={copyLink} className="shrink-0">
                <Copy className="h-4 w-4 mr-1.5" />
                Copiar Link
              </Button>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <a href={channel.public_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Abrir
                </a>
              </Button>
            </div>
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="positivo">✅ Positivo</SelectItem>
            <SelectItem value="negativo">⚠️ Negativo</SelectItem>
            <SelectItem value="sugestao">💡 Sugestão</SelectItem>
            <SelectItem value="outro">💬 Outro</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{total} mensagem{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Feedback list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : feedbacks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-muted-foreground">Nenhum feedback ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Compartilhe o link público para começar a receber mensagens anônimas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedbacks.map(fb => {
            const typeInfo = TYPE_LABELS[fb.type] ?? { label: fb.type, color: '#94a3b8' };
            return (
              <Card
                key={fb.id}
                className={fb.read ? 'opacity-70' : 'border-l-4'}
                style={!fb.read ? { borderLeftColor: typeInfo.color } : {}}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className="text-white text-xs"
                        style={{ backgroundColor: typeInfo.color }}
                      >
                        {typeInfo.label}
                      </Badge>
                      {fb.category && (
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[fb.category] ?? fb.category}
                        </Badge>
                      )}
                      {!fb.read && (
                        <Badge variant="secondary" className="text-xs">Nova</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(fb.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {!fb.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => markAsRead(fb.id)}
                        >
                          <CheckCheck className="h-3.5 w-3.5 mr-1" />
                          Lida
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-foreground leading-relaxed">{fb.message}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
