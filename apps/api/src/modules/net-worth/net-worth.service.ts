import { assetValueAt, cardCreditAt, netWorthDates, todayInSaoPaulo, type DateOnly, type NetWorthDTO } from '@fincontrol/shared';
import type { AssetsRepository } from '../assets/assets.repository';
import { byValue, toAssetDTO } from '../assets/assets.service';
import { debtsAt, type DebtsReader } from '../reports/debts';
import type { ReportsRepository } from '../reports/reports.repository';

/** B8: o mesmo período de "12 meses" dos relatórios. */
const SERIES_MONTHS = 12;

export type NetWorthServiceDeps = {
  reportsRepo: Pick<ReportsRepository, 'balancesAt'>;
  assetsRepo: Pick<AssetsRepository, 'list'>;
  debts: DebtsReader;
  clock: () => Date;
};

/** Patrimônio líquido (sub-projeto 11, B1 e B8): contas sem cartões + bens − dívidas, hoje e no fim de cada mês. */
export function createNetWorthService(deps: NetWorthServiceDeps) {
  return {
    async get(userId: string): Promise<NetWorthDTO> {
      const today = todayInSaoPaulo(deps.clock());
      const points = netWorthDates(today, SERIES_MONTHS);
      // Cada fonte é lida uma vez; os pontos saem em memória pelas mesmas regras do painel e do relatório.
      const [balances, assets, debtSources] = await Promise.all([
        deps.reportsRepo.balancesAt(userId, points.map((p) => p.date), { today }),
        deps.assetsRepo.list(userId),
        deps.debts.load(userId),
      ]);
      // O crédito do cartão pago a mais é dinheiro da pessoa: soma nas contas (a dívida do cartão para no zero).
      const cardCredit = (date: DateOnly) => debtSources.cards.reduce((sum, c) => sum + cardCreditAt(c, date), 0);
      const series = points.map((p, i) => {
        const accounts = balances[i]!.reduce((sum, b) => sum + b.balance, 0) + cardCredit(p.date);
        const assetsTotal = assets.reduce((sum, a) => sum + assetValueAt(a.valuations, p.date), 0);
        const debts = debtsAt(debtSources, p.date).total;
        return { month: p.month, date: p.date, accounts, assets: assetsTotal, debts, total: accounts + assetsTotal - debts };
      });
      // O último ponto é hoje: o resumo do topo e o gráfico mostram o mesmo número.
      const now = series[series.length - 1]!;
      return {
        date: today,
        accounts: { items: balances[balances.length - 1]!, cardCredit: cardCredit(today), total: now.accounts },
        assets: { items: assets.map((a) => toAssetDTO(a, today)).sort(byValue), total: now.assets },
        debts: debtsAt(debtSources, today),
        total: now.total,
        series,
      };
    },
  };
}

export type NetWorthService = ReturnType<typeof createNetWorthService>;
