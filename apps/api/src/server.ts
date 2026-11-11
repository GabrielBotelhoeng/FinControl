import app, { config, logger } from './index';

// Servidor local (npm run dev). Na Vercel, quem atende é o export default de ./index.
app.listen(config.PORT, () => {
  logger.info(`API do FinControl ouvindo em http://localhost:${config.PORT}`);
});
