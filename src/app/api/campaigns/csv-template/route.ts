import { NextResponse } from 'next/server';

export async function GET() {
  const headers = ['unidade', 'setor', 'cargo', 'cpf'];

  const exampleRows = [
    ['Unidade Centro', 'Recursos Humanos', 'Analista', '47161228829'],
    ['Unidade Norte', 'Operações', 'Técnico', '471612288328'],
    ['Unidade Norte', 'Operações', 'Supervisor', '47161228830'],
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
