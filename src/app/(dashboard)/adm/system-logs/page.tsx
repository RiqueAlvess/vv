'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSystemLogs, type LogFilters } from '@/hooks/use-system-logs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const LEVEL_COLORS: Record<string, string> = {
  ERROR: 'bg-red-100 text-red-700 border-red-200',
  WARN: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  AUDIT: 'bg-blue-100 text-blue-700 border-blue-200',
  INFO: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PAGE_SIZE = 50;

export default function LogsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<LogFilters>({ page: 1, limit: PAGE_SIZE });
  const [actionInput, setActionInput] = useState('');

  const { data, isLoading, isFetching, refetch } = useSystemLogs(filters);

  if (user?.role !== 'ADM') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const page = filters.page ?? 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function applyLevel(value: string) {
    setFilters((f) => ({ ...f, level: value === 'all' ? undefined : value, page: 1 }));
  }

  function applyAction() {
    setFilters((f) => ({ ...f, action: actionInput.trim() || undefined, page: 1 }));
  }

  function setPage(next: number) {
    setFilters((f) => ({ ...f, page: next }));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0D3D4F]">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auditoria e eventos registrados pelo sistema
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select onValueChange={applyLevel} defaultValue="all">
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="AUDIT">AUDIT</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
            <SelectItem value="WARN">WARN</SelectItem>
            <SelectItem value="INFO">INFO</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            placeholder="Filtrar por ação..."
            className="w-52"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyAction()}
          />
          <Button variant="outline" size="sm" onClick={applyAction}>
            Buscar
          </Button>
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">De</span>
          <Input
            type="date"
            className="w-40"
            onChange={(e) =>
              setFilters((f) => ({ ...f, from: e.target.value || undefined, page: 1 }))
            }
          />
          <span className="text-sm text-muted-foreground">até</span>
          <Input
            type="date"
            className="w-40"
            onChange={(e) =>
              setFilters((f) => ({ ...f, to: e.target.value || undefined, page: 1 }))
            }
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Data/Hora</TableHead>
              <TableHead className="w-24">Nível</TableHead>
              <TableHead className="w-48">Ação</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="w-36">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  Nenhum log encontrado.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${LEVEL_COLORS[log.level] ?? LEVEL_COLORS.INFO}`}
                    >
                      {log.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{log.action}</TableCell>
                  <TableCell className="text-sm">{log.message}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {log.ip ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} registro{total !== 1 ? 's' : ''} · página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
