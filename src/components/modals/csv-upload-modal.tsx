'use client';

import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CSVRow {
  unidade: string;
  setor: string;
  cargo: string;
  cpf: string;
}

interface CSVUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (data: CSVRow[]) => void;
  loading?: boolean;
}

/** Mask CPF for display: 123.456.789-09 → 123.***.***-09 */
function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

/** Basic CPF digit count validation (11 digits, not all same). */
function isValidCpfFormat(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // all same digit
  return true;
}

export function CSVUploadModal({ open, onOpenChange, onUpload, loading }: CSVUploadModalProps) {
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const header = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());

      const errs: string[] = [];
      const required = ['unidade', 'setor', 'cargo', 'cpf'];
      for (const col of required) {
        if (!header.includes(col)) errs.push(`Coluna "${col}" não encontrada`);
      }

      if (errs.length) {
        setErrors(errs);
        setRows([]);
        return;
      }

      const parsed: CSVRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]/).map(c => c.trim());
        const row: Record<string, string> = {};
        header.forEach((h, idx) => { row[h] = cols[idx] || ''; });

        if (!row.unidade?.trim() || !row.setor?.trim() || !row.cargo?.trim()) {
          errs.push(`Linha ${i + 1}: unidade, setor e cargo são obrigatórios`);
          continue;
        }

        if (!row.cpf?.trim()) {
          errs.push(`Linha ${i + 1}: CPF é obrigatório`);
          continue;
        }

        if (!isValidCpfFormat(row.cpf)) {
          errs.push(`Linha ${i + 1}: CPF inválido (${row.cpf})`);
          continue;
        }

        parsed.push({
          unidade: row.unidade,
          setor: row.setor,
          cargo: row.cargo,
          cpf: row.cpf,
        });
      }

      setErrors(errs);
      setRows(parsed);
    };
    reader.readAsText(file);
  }, []);

  const handleUpload = () => {
    if (rows.length > 0) onUpload(rows);
  };

  const reset = () => {
    setRows([]);
    setErrors([]);
    setFileName('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Colaboradores (CSV)</DialogTitle>
          <DialogDescription>
            O arquivo deve conter as colunas:{' '}
            <strong>unidade</strong>, <strong>setor</strong>, <strong>cargo</strong>, <strong>cpf</strong>{' '}
            (separado por vírgula ou ponto-e-vírgula). O CPF é usado como chave de acesso à pesquisa.
          </DialogDescription>
        </DialogHeader>

        {!rows.length && !errors.length ? (
          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="h-10 w-10 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Clique ou arraste o arquivo CSV</span>
            <span className="text-xs text-muted-foreground mt-1">Colunas: unidade, setor, cargo, cpf</span>
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <div className="flex gap-2">
                {rows.length > 0 && <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" />{rows.length} colaboradores válidos</Badge>}
                {errors.length > 0 && <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{errors.length} erros</Badge>}
              </div>
            </div>

            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-destructive">{err}</p>
                ))}
                {errors.length > 5 && <p className="text-xs text-destructive mt-1">...e mais {errors.length - 5} erros</p>}
              </div>
            )}

            {rows.length > 0 && (
              <>
                <ScrollArea className="h-56 rounded-md border">
                  <div className="min-w-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[25%]">Unidade</TableHead>
                          <TableHead className="w-[25%]">Setor</TableHead>
                          <TableHead className="w-[25%]">Cargo</TableHead>
                          <TableHead className="w-[25%]">CPF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 100).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm max-w-0">
                              <span className="block truncate" title={row.unidade}>{row.unidade}</span>
                            </TableCell>
                            <TableCell className="text-sm max-w-0">
                              <span className="block truncate" title={row.setor}>{row.setor}</span>
                            </TableCell>
                            <TableCell className="text-sm max-w-0">
                              <span className="block truncate" title={row.cargo}>{row.cargo}</span>
                            </TableCell>
                            <TableCell className="text-sm font-mono text-muted-foreground">
                              {maskCpf(row.cpf)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
                {rows.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Mostrando 100 de {rows.length} colaboradores
                  </p>
                )}
              </>
            )}

            <Button variant="outline" size="sm" onClick={reset}>Escolher outro arquivo</Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={rows.length === 0 || loading}>
            {loading ? 'Importando...' : `Importar ${rows.length} colaboradores`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
