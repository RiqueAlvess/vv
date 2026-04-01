import { NextResponse } from 'next/server';

export async function GET() {
  const headers = ['unidade', 'setor', 'cargo', 'email'];

  const exampleRow = [
    'Unidade Centro',
    'Recursos Humanos',
    'Analista',
    'joao.silva@empresa.com.br',
  ];

  const csv = [headers.join(','), exampleRow.join(',')].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-importacao.csv"',
    },
  });
}
