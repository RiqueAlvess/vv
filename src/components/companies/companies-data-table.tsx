'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Generic DataTable primitives ─────────────────────────────────────────
//
// A minimal typed column-definition system built on top of shadcn's Table.
// Intentionally lightweight — we don't need sorting or pagination at this scale.
// If that changes, swap the internals for @tanstack/react-table without
// changing any call sites (the ColumnDef shape maps directly).

export interface ColumnDef<TRow> {
  /** Unique key — also used as the React list key for header cells. */
  id: string;
  /** Text shown in <TableHead>. */
  header: string;
  /** Renders the cell content for a given row. */
  cell: (row: TRow) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<TRow> {
  columns: ColumnDef<TRow>[];
  data: TRow[];
  /** While true, renders skeleton rows instead of data. */
  isLoading: boolean;
  /** Number of skeleton rows to show. Default 5. */
  skeletonRows?: number;
  /** Shown when data is empty and not loading. */
  emptyMessage?: string;
  /** Must return a stable unique string for each row (used as React key). */
  getRowKey: (row: TRow) => string;
}

/**
 * Generic DataTable built with shadcn/ui Table + Skeleton.
 *
 * Rendering rules:
 *   isLoading=true  → skeleton rows (preserves column widths, no layout shift)
 *   isLoading=false, data=[]  → empty state message
 *   isLoading=false, data=[…] → populated rows
 *
 * The skeleton uses the SAME column structure as real rows so the layout
 * does not jump when data loads — columns stay the same width.
 */
export function DataTable<TRow>({
  columns,
  data,
  isLoading,
  skeletonRows = 5,
  emptyMessage = 'Nenhum registro encontrado',
  getRowKey,
}: DataTableProps<TRow>) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.id} className={col.headerClassName}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {isLoading ? (
          // Skeleton rows: one per skeletonRows, one cell per column
          Array.from({ length: skeletonRows }).map((_, rowIdx) => (
            <TableRow key={`skeleton-${rowIdx}`}>
              {columns.map((col) => (
                <TableCell key={col.id} className={col.cellClassName}>
                  <Skeleton className="h-5 w-full rounded" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : data.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-muted-foreground"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row) => (
            <TableRow key={getRowKey(row)}>
              {columns.map((col) => (
                <TableCell key={col.id} className={col.cellClassName}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
