import {
  assetSummary, compareByMoment, todayInSaoPaulo,
  type AssetDetailDTO, type AssetDTO, type AssetValuationInput, type CreateAssetInput, type DateOnly, type UpdateAssetInput,
} from '@fincontrol/shared';
import { NotFoundError, UnprocessableError } from '../../http/errors';
import { OnlyValuationError, type AssetRow, type AssetsRepository } from './assets.repository';

/** Resumo do bem para hoje; o repositório sempre devolve pelo menos um registro (B6). */
export function toAssetDTO(a: AssetRow, today: DateOnly): AssetDTO {
  return { id: a.id, name: a.name, kind: a.kind, ...assetSummary(a.valuations, today)! };
}

/** B11: do maior valor ao menor (os vendidos, com 0, no fim); empate pelo nome. */
export const byValue = (a: AssetDTO, b: AssetDTO) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR');

export function createAssetsService(deps: { repo: AssetsRepository; clock: () => Date }) {
  const today = () => todayInSaoPaulo(deps.clock());

  async function getOwned(userId: string, id: string): Promise<AssetRow> {
    const asset = await deps.repo.findById(userId, id);
    if (!asset) throw new NotFoundError('Bem');
    return asset;
  }

  async function detail(userId: string, id: string): Promise<AssetDetailDTO> {
    const asset = await getOwned(userId, id);
    // Histórico do mais novo ao mais antigo, na mesma ordem da regra B3.
    const valuations = [...asset.valuations].sort((a, b) => compareByMoment(b, a)).map(({ id: vid, date, amount }) => ({ id: vid, date, amount }));
    return { ...toAssetDTO(asset, today()), valuations };
  }

  const assertNotFuture = (date: DateOnly) => {
    if (date > today()) throw new UnprocessableError('A data não pode estar no futuro.');
  };

  return {
    async list(userId: string): Promise<AssetDTO[]> {
      const t = today();
      return (await deps.repo.list(userId)).map((a) => toAssetDTO(a, t)).sort(byValue);
    },

    get: detail,

    /** B5: com uma data no passado, o registro da compra e, se o valor mudou, o de hoje. */
    async create(userId: string, input: CreateAssetInput): Promise<AssetDetailDTO> {
      const t = today();
      const since = input.since ?? t;
      assertNotFuture(since);
      const valuations =
        since === t
          ? [{ date: t, amount: input.value }]
          : [
              { date: since, amount: input.purchaseValue ?? input.value },
              ...(input.purchaseValue !== undefined && input.purchaseValue !== input.value ? [{ date: t, amount: input.value }] : []),
            ];
      return detail(userId, await deps.repo.create(userId, { name: input.name, kind: input.kind }, valuations));
    },

    async update(userId: string, id: string, input: UpdateAssetInput): Promise<AssetDetailDTO> {
      await getOwned(userId, id);
      await deps.repo.update(userId, id, input);
      return detail(userId, id);
    },

    async remove(userId: string, id: string): Promise<void> {
      await getOwned(userId, id);
      await deps.repo.delete(userId, id);
    },

    async addValuation(userId: string, id: string, input: AssetValuationInput): Promise<AssetDetailDTO> {
      await getOwned(userId, id);
      assertNotFuture(input.date);
      await deps.repo.addValuation(userId, id, input);
      return detail(userId, id);
    },

    async removeValuation(userId: string, id: string, valuationId: string): Promise<void> {
      await getOwned(userId, id);
      try {
        if (!(await deps.repo.deleteValuation(userId, id, valuationId))) throw new NotFoundError('Valor');
      } catch (err) {
        if (err instanceof OnlyValuationError) {
          throw new UnprocessableError('Este é o único valor do bem. Para tirar o bem do patrimônio, exclua o bem.');
        }
        throw err;
      }
    },
  };
}

export type AssetsService = ReturnType<typeof createAssetsService>;
