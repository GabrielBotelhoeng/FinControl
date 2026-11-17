import type { ReportDTO, YearMonth } from '@fincontrol/shared';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../lib/api-context';

export function useReport(from: YearMonth, to: YearMonth) {
  const api = useApi();
  return useQuery({ queryKey: ['reports', from, to], queryFn: () => api.get<ReportDTO>('/reports', { from, to }) });
}

export type ExportKind = 'pdf' | 'csv';

/** R11: o mesmo nome que a API manda (a web não lê o `Content-Disposition`, que o CORS esconderia). */
export function exportFilename(kind: ExportKind, from: YearMonth, to: YearMonth): string {
  const slug = from === to ? from : `${from}_${to}`;
  return kind === 'pdf' ? `fincontrol-relatorio-${slug}.pdf` : `fincontrol-lancamentos-${slug}.csv`;
}

/** Entrega o arquivo ao navegador por um link temporário. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // O clique já começou o download; liberar no próximo ciclo evita cancelar no Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
