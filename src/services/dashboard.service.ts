import { ScoreService } from './score.service';
import { HSE_DIMENSIONS } from '@/lib/constants';
import { SurveyResponse, DimensionType, RiskLevel } from '@/types';

export class DashboardService {

  // Average dimension scores across all responses
  static getDimensionScores(responses: SurveyResponse[]): Record<string, number> {
    if (!responses.length) return {};
    const totals: Record<string, number[]> = {};

    for (const dim of HSE_DIMENSIONS) {
      totals[dim.key] = [];
    }

    for (const resp of responses) {
      const scores = ScoreService.calculateAllDimensionScores(resp.responses);
      for (const [key, value] of Object.entries(scores)) {
        totals[key]?.push(value);
      }
    }

    const averages: Record<string, number> = {};
    for (const [key, values] of Object.entries(totals)) {
      averages[key] = values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0;
    }
    return averages;
  }

  // Radar chart data
  static getRadarData(dimensionScores: Record<string, number>): { labels: string[]; values: number[]; colors: string[] } {
    const labels: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    for (const dim of HSE_DIMENSIONS) {
      labels.push(dim.name);
      const score = dimensionScores[dim.key] ?? 0;
      values.push(score);
      // Color based on risk interpretation considering dimension type
      const risk = ScoreService.getRiskLevel(score, dim.type);
      const nr = ScoreService.calculateNR(risk);
      colors.push(ScoreService.interpretNR(nr).color);
    }
    return { labels, values, colors };
  }

  // Risk distribution (donut chart) - count of risk levels across all response×dimension combinations
  static getRiskDistribution(responses: SurveyResponse[]): Record<RiskLevel, number> {
    const dist: Record<RiskLevel, number> = { aceitavel: 0, moderado: 0, importante: 0, critico: 0 };
    for (const resp of responses) {
      const scores = ScoreService.calculateAllDimensionScores(resp.responses);
      for (const dim of HSE_DIMENSIONS) {
        const risk = ScoreService.getRiskLevel(scores[dim.key as DimensionType], dim.type);
        dist[risk]++;
      }
    }
    return dist;
  }

  // Gender distribution (pie chart)
  static getGenderDistribution(responses: SurveyResponse[]): { labels: string[]; values: number[] } {
    const genderMap: Record<string, string> = { M: 'Masculino', F: 'Feminino', N: 'Não informado' };
    const counts: Record<string, number> = {};
    for (const resp of responses) {
      const g = resp.gender || 'N';
      const label = genderMap[g] || 'Não informado';
      counts[label] = (counts[label] || 0) + 1;
    }
    return { labels: Object.keys(counts), values: Object.values(counts) };
  }

  // Age range distribution (bar chart)
  static getAgeDistribution(responses: SurveyResponse[]): { labels: string[]; values: number[] } {
    const order = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
    const counts: Record<string, number> = {};
    for (const r of order) counts[r] = 0;
    for (const resp of responses) {
      const age = resp.age_range || 'Não informado';
      counts[age] = (counts[age] || 0) + 1;
    }
    // Filter out zeros except ordered ranges
    return { labels: Object.keys(counts), values: Object.values(counts) };
  }

  // Heatmap: sector × dimension (top 10 worst sectors)
  // This takes responses grouped by sector info from the analytics dim_sectors table
  static getHeatmapData(responses: SurveyResponse[], sectorMapping: Record<string, string>): Array<{ sector: string; scores: number[] }> {
    // Group responses by sector (using campaign_id -> sector lookup from analytics)
    // For simplicity, this returns scores per dimension for sectors
    // sectorMapping maps response session_uuid to sector_name
    const sectorScores: Record<string, number[][]> = {};

    for (const resp of responses) {
      const sector = sectorMapping[resp.session_uuid] || 'Sem Setor';
      if (!sectorScores[sector]) {
        sectorScores[sector] = HSE_DIMENSIONS.map(() => []);
      }
      const scores = ScoreService.calculateAllDimensionScores(resp.responses);
      HSE_DIMENSIONS.forEach((dim, i) => {
        sectorScores[sector][i].push(scores[dim.key as DimensionType]);
      });
    }

    const result = Object.entries(sectorScores).map(([sector, dimArrays]) => ({
      sector,
      scores: dimArrays.map(arr => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0),
    }));

    // Sort by sum of scores ascending (worst first for negative, but we sort by total risk)
    result.sort((a, b) => {
      const sumA = a.scores.reduce((acc, s, i) => {
        const dim = HSE_DIMENSIONS[i];
        const risk = ScoreService.getRiskLevel(s, dim.type);
        return acc + ScoreService.calculateNR(risk);
      }, 0);
      const sumB = b.scores.reduce((acc, s, i) => {
        const dim = HSE_DIMENSIONS[i];
        const risk = ScoreService.getRiskLevel(s, dim.type);
        return acc + ScoreService.calculateNR(risk);
      }, 0);
      return sumB - sumA; // highest risk first
    });

    return result.slice(0, 10);
  }

  // Top 5 critical sectors
  static getTopCriticalSectors(responses: SurveyResponse[], sectorMapping: Record<string, string>): Array<{ sector: string; percentage: number; color: string }> {
    const sectorResponses: Record<string, SurveyResponse[]> = {};
    for (const resp of responses) {
      const sector = sectorMapping[resp.session_uuid] || 'Sem Setor';
      if (!sectorResponses[sector]) sectorResponses[sector] = [];
      sectorResponses[sector].push(resp);
    }

    const result = Object.entries(sectorResponses).map(([sector, resps]) => {
      let criticalCount = 0;
      let totalCount = 0;
      for (const resp of resps) {
        const scores = ScoreService.calculateAllDimensionScores(resp.responses);
        for (const dim of HSE_DIMENSIONS) {
          const risk = ScoreService.getRiskLevel(scores[dim.key as DimensionType], dim.type);
          const nr = ScoreService.calculateNR(risk);
          if (nr >= 13) criticalCount++;
          totalCount++;
        }
      }
      const pct = totalCount > 0 ? Number(((criticalCount / totalCount) * 100).toFixed(1)) : 0;
      return {
        sector,
        percentage: pct,
        color: pct > 50 ? '#ef4444' : pct > 25 ? '#f97316' : '#eab308',
      };
    });

    result.sort((a, b) => b.percentage - a.percentage);
    return result.slice(0, 5);
  }

  // Scores by gender (line chart)
  static getScoresByGender(responses: SurveyResponse[]): Record<string, Record<string, number>> {
    const genderMap: Record<string, string> = { M: 'Masculino', F: 'Feminino', N: 'Não informado' };
    const grouped: Record<string, SurveyResponse[]> = {};
    for (const resp of responses) {
      const g = genderMap[resp.gender || 'N'] || 'Não informado';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(resp);
    }
    const result: Record<string, Record<string, number>> = {};
    for (const [gender, resps] of Object.entries(grouped)) {
      result[gender] = this.getDimensionScores(resps);
    }
    return result;
  }

  // Scores by age range (line chart)
  static getScoresByAge(responses: SurveyResponse[]): Record<string, Record<string, number>> {
    const grouped: Record<string, SurveyResponse[]> = {};
    for (const resp of responses) {
      const age = resp.age_range || 'Não informado';
      if (!grouped[age]) grouped[age] = [];
      grouped[age].push(resp);
    }
    const result: Record<string, Record<string, number>> = {};
    for (const [age, resps] of Object.entries(grouped)) {
      result[age] = this.getDimensionScores(resps);
    }
    return result;
  }

  // Top 3 critical demographic groups
  static getTopCriticalGroups(responses: SurveyResponse[]): Array<{ group: string; riskLevel: number; totalResponses: number; color: string }> {
    const genderMap: Record<string, string> = { M: 'Masculino', F: 'Feminino', N: 'Não informado' };
    const grouped: Record<string, SurveyResponse[]> = {};

    for (const resp of responses) {
      const g = genderMap[resp.gender || 'N'] || 'Não informado';
      const age = resp.age_range || 'Não informado';
      const key = `${g} (${age})`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(resp);
    }

    const result = Object.entries(grouped)
      .filter(([, resps]) => resps.length >= 5) // minimum 5 for anonymity
      .map(([group, resps]) => {
        let criticalCount = 0;
        let totalCount = 0;
        for (const resp of resps) {
          const scores = ScoreService.calculateAllDimensionScores(resp.responses);
          for (const dim of HSE_DIMENSIONS) {
            const risk = ScoreService.getRiskLevel(scores[dim.key as DimensionType], dim.type);
            const nr = ScoreService.calculateNR(risk);
            if (nr >= 13) criticalCount++;
            totalCount++;
          }
        }
        const pct = totalCount > 0 ? Number(((criticalCount / totalCount) * 100).toFixed(1)) : 0;
        return {
          group,
          riskLevel: pct,
          totalResponses: resps.length,
          color: pct > 50 ? '#ef4444' : pct > 25 ? '#f97316' : '#eab308',
        };
      });

    result.sort((a, b) => b.riskLevel - a.riskLevel);
    return result.slice(0, 3);
  }
}
