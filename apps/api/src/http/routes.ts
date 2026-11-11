import type { Router } from 'express';
import { profileRouter } from '../modules/profile/profile.routes';
import type { Container } from './container';

export function registerRoutes(api: Router, c: Container): void {
  api.use('/me', profileRouter(c.profile));
}
