import { reportQuerySchema } from '@fincontrol/shared';
import { Router, type Response } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import { periodSlug, transactionsCsv } from './reports.csv';
import type { ReportsService } from './reports.service';

/** O nome do arquivo só tem letras, números e hífens (R11), então vai entre aspas sem escape. */
function download(res: Response, contentType: string, filename: string): Response {
  return res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="${filename}"` });
}

export function reportsRouter(service: ReportsService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { from, to } = parse(reportQuerySchema, req.query);
    res.json(await service.build(userIdOf(res), from, to));
  });
  r.get('/export.csv', async (req, res) => {
    const { from, to } = parse(reportQuerySchema, req.query);
    const csv = transactionsCsv(await service.csvRows(userIdOf(res), from, to));
    download(res, 'text/csv; charset=utf-8', `fincontrol-lancamentos-${periodSlug(from, to)}.csv`).send(csv);
  });
  r.get('/export.xlsx', async (req, res) => {
    const { from, to } = parse(reportQuerySchema, req.query);
    const xlsx = await service.xlsx(userIdOf(res), from, to);
    download(res, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `fincontrol-analise-${periodSlug(from, to)}.xlsx`).send(xlsx);
  });
  r.get('/export.pdf', async (req, res) => {
    const { from, to } = parse(reportQuerySchema, req.query);
    const pdf = await service.pdf(userIdOf(res), from, to);
    download(res, 'application/pdf', `fincontrol-relatorio-${periodSlug(from, to)}.pdf`).send(Buffer.from(pdf));
  });
  return r;
}
