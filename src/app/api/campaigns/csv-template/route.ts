import { NextResponse } from 'next/server';

export async function GET() {
  const headers = ['unidade', 'setor', 'cargo'];

  const exampleRows = [
    ['Unidade Centro', 'Recursos Humanos', 'Analista'],
    ['Unidade Norte', 'Operações', 'Técnico'],
    ['Unidade Norte', 'Operações', 'Supervisor'],
  ];

  const csv = [headers.join(','), ...exampleRows.map((r) => r.join(','))].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-importacao.csv"',
    },
  });
}
