import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const RISK_COLORS = {
  aceitavel: '#22c55e',
  moderado: '#eab308',
  importante: '#f97316',
  critico: '#ef4444',
} as const;

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#1e293b' },
  header: { marginBottom: 24, borderBottom: '2pt solid #1e3a5f', paddingBottom: 12 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1e3a5f', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#475569' },
  section: { marginTop: 16 },
  unitHeader: { backgroundColor: '#1e3a5f', color: '#ffffff', padding: '6 10', fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6, borderRadius: 4 },
  sectorHeader: { backgroundColor: '#dbeafe', color: '#1e40af', padding: '4 10', fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 4, marginLeft: 12 },
  positionHeader: { padding: '3 10', fontSize: 9, color: '#475569', fontFamily: 'Helvetica-Bold', marginLeft: 24 },
  dimensionRow: { flexDirection: 'row', marginLeft: 36, paddingVertical: 2, borderBottom: '0.5pt solid #f1f5f9' },
  dimName: { width: '40%', fontSize: 9 },
  dimScore: { width: '15%', fontSize: 9, textAlign: 'center' },
  dimRisk: { width: '20%', fontSize: 9, textAlign: 'center' },
  dimNR: { width: '10%', fontSize: 9, textAlign: 'center' },
  suppressed: { marginLeft: 36, fontSize: 9, color: '#94a3b8', fontStyle: 'italic', paddingVertical: 4 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8' },
  anonymityNote: { backgroundColor: '#fef9c3', padding: '8 10', marginTop: 12, marginBottom: 16, borderRadius: 4, fontSize: 8, color: '#713f12' },
  tableHeader: { flexDirection: 'row', marginLeft: 36, paddingVertical: 3, borderBottom: '1pt solid #e2e8f0', marginBottom: 2 },
});

interface PositionReport {
  name: string;
  dimensions: Record<string, { score: number; risk: string; nr: number }>;
}
interface SectorReport { name: string; positions: PositionReport[] }
interface UnitReport { name: string; sectors: SectorReport[] }

interface PGRReportProps {
  companyName: string;
  cnpj: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  totalRespondents: number;
  units: UnitReport[];
}

const HSE_DIMENSION_NAMES: Record<string, string> = {
  demandas: 'Demandas',
  controle: 'Controle',
  apoio_chefia: 'Apoio da Chefia',
  apoio_colegas: 'Apoio dos Colegas',
  relacionamentos: 'Relacionamentos',
  cargo: 'Cargo/Funcao',
  comunicacao_mudancas: 'Comunicacao e Mudancas',
};

const RISK_LABELS: Record<string, string> = {
  aceitavel: 'Aceitavel',
  moderado: 'Moderado',
  importante: 'Importante',
  critico: 'Critico',
};

const MIN_RESPONDENTS = 5;

export function PGRReportDocument({
  companyName,
  cnpj,
  campaignName,
  startDate,
  endDate,
  generatedAt,
  totalRespondents,
  units,
}: PGRReportProps) {
  return (
    <Document title={`Relatorio PGR - ${campaignName}`} author="Asta">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Relatorio PGR - Riscos Psicossociais NR-1</Text>
          <Text style={styles.subtitle}>{companyName} - CNPJ: {cnpj}</Text>
          <Text style={styles.subtitle}>Campanha: {campaignName} | Periodo: {startDate} a {endDate}</Text>
          <Text style={styles.subtitle}>Gerado em: {generatedAt} | Instrumento: HSE-IT (35 questoes, 7 dimensoes)</Text>
        </View>

        {/* Anonymity note */}
        <View style={styles.anonymityNote}>
          <Text>
            Nota de anonimato: Os scores sao calculados sobre o total de {totalRespondents} respondentes da campanha.
            Por garantia tecnica de anonimato (arquitetura Blind-Drop, LGPD Art. 12), nao e possivel vincular respostas
            individuais a cargos especificos. Posicoes com menos de {MIN_RESPONDENTS} respondentes sao suprimidas.
          </Text>
        </View>

        {/* Hierarchy */}
        {units.map((unit) => (
          <View key={unit.name} style={styles.section}>
            <Text style={styles.unitHeader}>UNIDADE: {unit.name.toUpperCase()}</Text>
            {unit.sectors.map((sector) => (
              <View key={sector.name}>
                <Text style={styles.sectorHeader}>Setor: {sector.name}</Text>
                {sector.positions.map((position) => {
                  const hasDimensions = Object.keys(position.dimensions).length > 0;
                  if (!hasDimensions || totalRespondents < MIN_RESPONDENTS) {
                    return (
                      <View key={position.name}>
                        <Text style={styles.positionHeader}>Cargo: {position.name}</Text>
                        <Text style={styles.suppressed}>
                          Dados suprimidos - protecao de identidade (menos de {MIN_RESPONDENTS} respondentes)
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View key={position.name}>
                      <Text style={styles.positionHeader}>Cargo: {position.name}</Text>
                      {/* Table header */}
                      <View style={styles.tableHeader}>
                        <Text style={[styles.dimName, { fontFamily: 'Helvetica-Bold' }]}>Dimensao</Text>
                        <Text style={[styles.dimScore, { fontFamily: 'Helvetica-Bold' }]}>Score</Text>
                        <Text style={[styles.dimRisk, { fontFamily: 'Helvetica-Bold' }]}>Classificacao</Text>
                        <Text style={[styles.dimNR, { fontFamily: 'Helvetica-Bold' }]}>NR</Text>
                      </View>
                      {Object.entries(position.dimensions).map(([key, dim]) => (
                        <View key={key} style={styles.dimensionRow}>
                          <Text style={styles.dimName}>{HSE_DIMENSION_NAMES[key] ?? key}</Text>
                          <Text style={styles.dimScore}>{dim.score.toFixed(2)}</Text>
                          <Text style={[styles.dimRisk, { color: RISK_COLORS[dim.risk as keyof typeof RISK_COLORS] ?? '#94a3b8' }]}>
                            {RISK_LABELS[dim.risk] ?? dim.risk}
                          </Text>
                          <Text style={styles.dimNR}>{dim.nr}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Asta - Plataforma de Riscos Psicossociais NR-1 | Confidencial</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
