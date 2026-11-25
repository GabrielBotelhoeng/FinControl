import { Ban, KeyRound, MapPin, Trash2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { IconTile } from '../../components/ui/icon-tile';
import { PALETTE } from '../../lib/palette';
import { Reveal, RevealItem } from './reveal';
import { SectionHeading } from './section-heading';

const ITEMS: { title: string; text: string; icon: LucideIcon; tint: string }[] = [
  { title: 'Servidor no Brasil', text: 'O banco de dados e a API ficam em São Paulo.', icon: MapPin, tint: PALETTE.sky },
  { title: 'Só você acessa', text: 'Cada consulta é filtrada pela sua conta; ninguém vê os lançamentos de outra pessoa.', icon: KeyRound, tint: PALETTE.lime },
  { title: 'Apague quando quiser', text: 'Em Perfil, "Excluir minha conta" apaga a conta e os dados na hora, como manda a LGPD.', icon: Trash2, tint: PALETTE.tangerine },
  { title: 'Nada de venda de dados', text: 'Não vendemos, não alugamos e não usamos seus dados para anúncios.', icon: Ban, tint: PALETTE.grape },
];

/** "Seus dados" (seção 3.7): quatro garantias com ícone e os links para a privacidade e os termos. */
export function PrivacyBlock() {
  return (
    <section aria-labelledby="dados-titulo" className="px-4 pb-14 pt-20 md:px-10 md:pb-20 md:pt-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          id="dados-titulo"
          eyebrow="Seus dados"
          title={
            <>
              <span className="font-extralight">Seu dinheiro é</span> <span className="font-extrabold">assunto seu.</span>
            </>
          }
        />
        <Reveal as="ul" stagger={0.07} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <RevealItem as="li" key={item.title} className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-panel">
              <IconTile icon={item.icon} color={item.tint} />
              <h3 className="mt-5 font-display text-xl font-bold tracking-[-0.015em]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
            </RevealItem>
          ))}
        </Reveal>
        <p className="mt-8 text-sm text-muted">
          Leia a{' '}
          <Link to="/privacidade" className="font-semibold text-primary underline">
            Política de privacidade
          </Link>{' '}
          e os{' '}
          <Link to="/termos" className="font-semibold text-primary underline">
            Termos de Uso
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
