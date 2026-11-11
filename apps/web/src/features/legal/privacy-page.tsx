import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Panel } from '../../components/ui/panel';

const CONTACT = 'botelhog45@gmail.com';
const UPDATED_AT = '11 de novembro de 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-[0.95rem] leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-text">{children}</div>
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-primary">{children}</ul>;
}

const mail = (
  <a href={`mailto:${CONTACT}`} className="text-text underline underline-offset-2 hover:text-primary">
    {CONTACT}
  </a>
);

/** Página pública (fora do login), exigida pelo Google para publicar o login OAuth. */
export default function PrivacyPage() {
  return (
    <div className="aurora min-h-dvh">
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 md:px-8 md:py-16">
        <Link to="/entrar" className="inline-flex w-fit items-center gap-2 text-sm text-muted hover:text-text">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Voltar para o FinControl
        </Link>
        <header className="flex flex-col gap-3">
          <p className="font-display text-lg tracking-tight">
            <span className="font-extralight">Fin</span>
            <span className="font-extrabold">Control</span>
          </p>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] font-extrabold leading-tight tracking-[-0.02em]">Política de Privacidade</h1>
          <p className="text-sm text-muted">Última atualização: {UPDATED_AT}</p>
        </header>

        <Panel className="flex flex-col gap-8 p-6 md:p-10">
          <p className="text-[0.95rem] leading-relaxed text-muted">
            O FinControl é um app de controle financeiro pessoal, mantido por um desenvolvedor independente. Esta página explica, em linguagem
            direta, quais dados o app trata, para quê e como você controla esses dados, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº
            13.709/2018).
          </p>

          <Section title="Quais dados coletamos">
            <List>
              <li>
                <strong>Conta:</strong> nome e e-mail. Se você entra com e-mail e senha, a senha é guardada pelo provedor de autenticação apenas
                em formato cifrado (hash) — o FinControl nunca a vê.
              </li>
              <li>
                <strong>Login com Google:</strong> se você escolher essa opção, recebemos do Google apenas seu nome, e-mail e foto de perfil
                públicos. Não acessamos Gmail, Drive, contatos nem nada além disso.
              </li>
              <li>
                <strong>Dados financeiros que você cadastra:</strong> contas, categorias, lançamentos e recorrências (valores, datas e
                descrições).
              </li>
              <li>
                <strong>Preferências:</strong> o tema escolhido (claro, escuro ou do sistema).
              </li>
              <li>
                <strong>Modo demonstração:</strong> o botão “Experimentar sem cadastro” cria um usuário anônimo, sem nome real nem e-mail, com
                dados fictícios.
              </li>
              <li>
                <strong>Dados técnicos:</strong> os registros da aplicação guardam só o identificador da requisição, o método, o endereço
                acessado e o resultado. Os provedores de infraestrutura processam dados como o endereço IP para entregar e proteger o serviço
                (por exemplo, para limitar abusos).
              </li>
            </List>
            <p>
              No seu navegador, o app guarda apenas a sessão de login e a preferência de tema. Não usamos cookies de rastreamento, ferramentas
              de análise de audiência nem publicidade.
            </p>
          </Section>

          <Section title="Como usamos os dados">
            <p>
              Exclusivamente para o app funcionar: autenticar você, guardar e mostrar suas finanças, calcular saldos e previsões e manter o
              serviço seguro. A base legal é a execução do serviço que você solicitou (art. 7º, V, da LGPD). Não vendemos, não alugamos e não
              usamos seus dados para anúncios ou para treinar modelos de inteligência artificial.
            </p>
          </Section>

          <Section title="Com quem compartilhamos">
            <p>Somente com os provedores que operam o app, cada um limitado ao necessário:</p>
            <List>
              <li>
                <strong>Supabase:</strong> banco de dados e autenticação, com os dados hospedados em São Paulo (Brasil).
              </li>
              <li>
                <strong>Vercel:</strong> hospedagem do site e da API. Parte do processamento pode ocorrer fora do Brasil, com as garantias
                previstas pela LGPD para transferência internacional.
              </li>
              <li>
                <strong>Google:</strong> apenas se você usar o login com Google.
              </li>
            </List>
            <p>Fora isso, só compartilharíamos dados se uma lei ou ordem judicial exigisse.</p>
          </Section>

          <Section title="Por quanto tempo guardamos">
            <List>
              <li>
                Seus dados ficam guardados enquanto sua conta existir. Em <strong>Perfil → “Excluir minha conta”</strong>, você apaga na hora
                seu perfil, todos os dados financeiros e seu usuário de login.
              </li>
              <li>Contas do modo demonstração e seus dados fictícios são apagados automaticamente após 7 dias.</li>
            </List>
          </Section>

          <Section title="Segurança">
            <p>
              O tráfego é sempre cifrado (HTTPS), e a API só entrega a cada pessoa os dados da própria conta, conferindo a sessão em todas as
              requisições. Nenhum sistema é infalível; se identificarmos um incidente que afete seus dados, você será avisado.
            </p>
          </Section>

          <Section title="Seus direitos">
            <p>
              Pela LGPD, você pode a qualquer momento pedir confirmação de que tratamos seus dados, acesso, correção, portabilidade, exclusão e
              informações sobre compartilhamento, além de revogar o consentimento. A maior parte disso você faz no próprio app (editar perfil e
              lançamentos, excluir a conta); para o restante, escreva para {mail}.
            </p>
          </Section>

          <Section title="Mudanças nesta política">
            <p>Se esta política mudar, a data no topo da página será atualizada.</p>
          </Section>

          <Section title="Contato">
            <p>Dúvidas ou pedidos sobre privacidade: {mail}.</p>
          </Section>
        </Panel>
      </main>
    </div>
  );
}
