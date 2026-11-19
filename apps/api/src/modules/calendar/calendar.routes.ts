import { calendarQuerySchema } from '@fincontrol/shared';
import { Router } from 'express';
import { userIdOf } from '../../http/auth';
import { parse } from '../../http/validate';
import type { CalendarService } from './calendar.service';

export function calendarRouter(service: CalendarService): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { month } = parse(calendarQuerySchema, req.query);
    res.json(await service.month(userIdOf(res), month));
  });
  return r;
}
