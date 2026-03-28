'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useApi } from '@/hooks/use-api';
import { useNotifications } from '@/hooks/use-notifications';
import { CHECKLIST_STAGES, TOTAL_ITEMS } from '@/lib/checklist-items';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Check, Save, Upload, X, FileText,
  ChevronDown, ChevronUp, Paperclip,
} from 'lucide-react';

interface Evidence {
  id: string;
  item_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_at: string;
}

interface CampaignChecklistProps {
  campaignId: string;
  canEdit: boolean;
}

export function CampaignChecklist({ campaignId, canEdit }: CampaignChecklistProps) {
  const { get, post, fetchWithAuth } = useApi();
  const { success, error: notifyError } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(
    new Set(CHECKLIST_STAGES.map(s => s.id))
  );

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/api/checklist?campaign_id=${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setCheckedItems(new Set(data.checked_items as string[]));
        setEvidences(data.evidences ?? []);
        if (data.updated_at) setLastSaved(new Date(data.updated_at));
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId, get]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  const toggleItem = (itemId: string) => {
    if (!canEdit) return;
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await post('/api/checklist', {
        campaign_id: campaignId,
        checked_items: Array.from(checkedItems),
      });
      if (res.ok) {
        setLastSaved(new Date());
        success('Progresso salvo');
      }
    } catch {
      notifyError('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (itemId: string, file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('item_id', itemId);
      fd.append('campaign_id', campaignId);

      const res = await fetchWithAuth('/api/checklist/upload', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json();
        notifyError(data.error ?? 'Erro ao fazer upload');
        return;
      }

      const evidence = await res.json();
      setEvidences(prev => [evidence, ...prev]);
      success('Evidencia adicionada');
    } catch {
      notifyError('Erro ao fazer upload');
    } finally {
      setUploading(false);
      setPendingItemId(null);
    }
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    try {
      await fetchWithAuth(`/api/checklist/upload/${evidenceId}`, { method: 'DELETE' });
      setEvidences(prev => prev.filter(e => e.id !== evidenceId));
    } catch {
      notifyError('Erro ao remover');
    }
  };

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const completedCount = checkedItems.size;
  const progressPct = TOTAL_ITEMS > 0 ? Math.round((completedCount / TOTAL_ITEMS) * 100) : 0;

  const stageProgress = (stage: typeof CHECKLIST_STAGES[0]) => {
    const checked = stage.items.filter(i => checkedItems.has(i.id)).length;
    return { checked, total: stage.items.length };
  };

  const getEvidencesForItem = (itemId: string) =>
    evidences.filter(e => e.item_id === itemId);

  const isImage = (type: string) => type.startsWith('image/');

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Progresso do Checklist</p>
              <p className="text-xs text-muted-foreground">
                {completedCount} de {TOTAL_ITEMS} itens concluidos
                {lastSaved && (
                  <span> — salvo {format(lastSaved, "dd/MM 'as' HH:mm", { locale: ptBR })}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-xl font-bold"
                style={{
                  color: progressPct >= 80 ? '#22c55e' :
                         progressPct >= 50 ? '#eab308' : '#ef4444',
                }}
              >
                {progressPct}%
              </span>
              {canEdit && (
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              )}
            </div>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Stages */}
      {CHECKLIST_STAGES.map(stage => {
        const p = stageProgress(stage);
        const isExpanded = expandedStages.has(stage.id);
        const allDone = p.checked === p.total;

        return (
          <Card key={stage.id} className={allDone ? 'border-green-200' : ''}>
            <CardHeader
              className="pb-3 cursor-pointer select-none py-3"
              onClick={() => toggleStage(stage.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    allDone ? 'bg-green-500 text-white' :
                    p.checked > 0 ? 'bg-primary/20 text-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {allDone ? <Check className="h-3.5 w-3.5" /> : stage.id.split('-')[1]}
                  </div>
                  <CardTitle className="text-sm">{stage.title}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={allDone ? 'default' : 'secondary'}
                    className={`text-xs ${allDone ? 'bg-green-500' : ''}`}
                  >
                    {p.checked}/{p.total}
                  </Badge>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-1.5">
                {stage.items.map(item => {
                  const checked = checkedItems.has(item.id);
                  const itemEvidences = getEvidencesForItem(item.id);
                  const isUploadingThis = pendingItemId === item.id && uploading;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-md border transition-colors ${
                        checked ? 'border-green-200 bg-green-50/50' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3 p-2.5">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          disabled={!canEdit}
                          className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            checked
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-muted-foreground/40 hover:border-primary'
                          } ${!canEdit ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </button>

                        {/* Text */}
                        <p className={`text-sm flex-1 leading-relaxed ${
                          checked ? 'line-through text-muted-foreground' : ''
                        }`}>
                          {item.text}
                        </p>

                        {/* Upload button */}
                        {canEdit && (
                          <div className="flex items-center gap-1 shrink-0">
                            {itemEvidences.length > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Paperclip className="h-3 w-3" />
                                {itemEvidences.length}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPendingItemId(item.id);
                                if (fileInputRef.current) {
                                  fileInputRef.current.setAttribute('data-item-id', item.id);
                                  fileInputRef.current.click();
                                }
                              }}
                              disabled={isUploadingThis}
                              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="Adicionar evidencia"
                            >
                              {isUploadingThis
                                ? <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                : <Upload className="h-3.5 w-3.5" />
                              }
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Evidences */}
                      {itemEvidences.length > 0 && (
                        <div className="px-2.5 pb-2.5 pt-0 border-t border-border/40">
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {itemEvidences.map(ev => (
                              <div
                                key={ev.id}
                                className="flex items-center gap-1.5 rounded border bg-background px-2 py-1 text-xs"
                              >
                                {isImage(ev.file_type) ? (
                                  <a href={ev.file_url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={ev.file_url}
                                      alt={ev.file_name}
                                      className="h-7 w-10 object-cover rounded"
                                    />
                                  </a>
                                ) : (
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <a
                                  href={ev.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="max-w-[100px] truncate hover:underline"
                                >
                                  {ev.file_name}
                                </a>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEvidence(ev.id)}
                                    className="text-muted-foreground hover:text-destructive ml-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const itemId = e.target.getAttribute('data-item-id');
          if (file && itemId) await handleFileUpload(itemId, file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
