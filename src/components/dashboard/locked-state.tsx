'use client';

import { Lock, Clock, FileText } from 'lucide-react';

interface LockedStateProps {
  /** Raw campaign status from DB: 'draft' | 'active' | 'closed' */
  status: string;
  campaignName?: string;
}

/**
 * Rendered when campaign.status !== 'closed'.
 *
 * NR-1 compliance context: analytics data is intentionally withheld until the
 * campaign is closed. Releasing partial results while collection is in progress
 * would let observers infer which invitations have been responded to by
 * correlating status changes with report updates — breaking the anonymity
 * guarantee the Blind Drop protocol provides.
 *
 * The message changes based on status so the user understands what action
 * (if any) unblocks the dashboard.
 */
export function LockedState({ status, campaignName }: LockedStateProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG._default;

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-6">
      {/* Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <config.Icon className="w-9 h-9 text-muted-foreground" />
        </div>
        {/* Lock badge overlay */}
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border-2 border-border flex items-center justify-center">
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Heading */}
      <h2 className="text-xl font-semibold tracking-tight">{config.title}</h2>

      {/* Campaign name callout */}
      {campaignName && (
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {campaignName}
        </p>
      )}

      {/* Explanation */}
      <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
        {config.description}
      </p>

      {/* Anonymity note */}
      <p className="mt-4 max-w-sm text-xs text-muted-foreground/70 leading-relaxed border border-dashed border-border rounded-lg px-4 py-3">
        <span className="font-medium text-muted-foreground">Proteção de anonimato: </span>
        Os resultados são liberados somente após o encerramento da coleta para impedir
        a correlação temporal entre respostas e o status dos convites.
      </p>
    </div>
  );
}

// ─── Status-specific copy ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { Icon: React.ElementType; title: string; description: string }
> = {
  draft: {
    Icon: FileText,
    title: 'Campanha em rascunho',
    description:
      'Esta campanha ainda não foi ativada. Importe os colaboradores via CSV, envie os convites e ative a campanha para iniciar a coleta de respostas.',
  },
  active: {
    Icon: Clock,
    title: 'Coleta em andamento',
    description:
      'Os dados analíticos ficam bloqueados enquanto a campanha está ativa. Encerre a campanha quando o prazo de coleta terminar para liberar o dashboard.',
  },
  _default: {
    Icon: Lock,
    title: 'Dashboard indisponível',
    description:
      'O dashboard está disponível apenas para campanhas encerradas.',
  },
};
