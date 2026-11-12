import { DocLink, LegalPage, List, MailLink, Section } from './legal-layout';

const VERSION = 'Versão 1 · Em vigor desde 12 de novembro de 2026';

/** Página pública (fora do login). Idade mínima de 18 anos, decidida pelo dono do produto em 2026-11-12. */
export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      meta={VERSION}
      intro={
        <>
          Estes termos regem o uso do FinControl. Ao criar uma conta, entrar com o Google ou usar o modo demonstração, você concorda com eles e
          com a <DocLink to="/privacidade">Política de Privacidade</DocLink>, que explica como tratamos seus dados.
        </>
      }
    >
      <Section title="Quem somos">
        <p>
          O FinControl é um app gratuito de controle financeiro pessoal, mantido por um desenvolvedor independente. Contato: <MailLink />.
        </p>
      </Section>

      <Section title="Quem pode usar">
        <p>
          O FinControl é destinado a maiores de 18 anos, civilmente capazes. Não é permitido criar conta nem usar o app com menos de 18 anos; se
          identificarmos uma conta de menor de idade, ela será excluída.
        </p>
        <p>
          Você informa dados verdadeiros e mantém sua senha em sigilo. A atividade feita na sua conta é de sua responsabilidade, salvo falha
          nossa.
        </p>
      </Section>

      <Section title="O que o FinControl é e o que não é">
        <p>
          É uma ferramenta para organizar suas finanças a partir do que você mesmo lança: contas, receitas, despesas, transferências e
          recorrências.
        </p>
        <List>
          <li>O FinControl não é uma instituição financeira: não guarda, não movimenta e não transfere dinheiro.</li>
          <li>Não se conecta à sua conta bancária. Saldos e lançamentos vêm do que você cadastra.</li>
          <li>
            O app não é recomendação de investimento nem consultoria financeira. Saldos, previsões e indicadores são cálculos sobre os seus
            lançamentos, para apoiar decisões que continuam sendo suas. Confira os números antes de decisões importantes.
          </li>
        </List>
      </Section>

      <Section title="Modo demonstração">
        <p>
          O botão “Experimentar sem cadastro” cria uma conta anônima com dados fictícios, apagada automaticamente após 7 dias. Não use dados
          reais nela.
        </p>
      </Section>

      <Section title="Regras de uso">
        <p>Você não pode:</p>
        <List>
          <li>acessar ou tentar acessar dados de outras contas;</li>
          <li>tentar burlar a segurança ou sobrecarregar o serviço com requisições automatizadas;</li>
          <li>usar o app para fins ilegais;</li>
          <li>fazer engenharia reversa além do que a lei permite.</li>
        </List>
      </Section>

      <Section title="Preço">
        <p>O FinControl é gratuito e não coleta dados de pagamento.</p>
      </Section>

      <Section title="Seus dados e sua conta">
        <p>
          Os dados que você lança são seus. Nós os armazenamos e processamos apenas para prestar o serviço, como descreve a Política de
          Privacidade. Você pode excluir sua conta a qualquer momento em <strong>Perfil → “Excluir minha conta”</strong>, o que apaga na hora
          todos os seus dados. Podemos suspender ou encerrar contas que violem estes termos.
        </p>
      </Section>

      <Section title="Disponibilidade e mudanças">
        <p>
          Buscamos manter o app no ar, mas não garantimos funcionamento ininterrupto, e as funcionalidades podem mudar. Se estes termos mudarem,
          a versão e a data no topo serão atualizadas; se você não concordar, pode excluir sua conta.
        </p>
      </Section>

      <Section title="Responsabilidade">
        <p>
          O FinControl é uma ferramenta de apoio à organização financeira. Nada nestes termos afasta os direitos garantidos pelo Código de
          Defesa do Consumidor.
        </p>
      </Section>

      <Section title="Lei e foro">
        <p>Estes termos seguem a lei brasileira. Eventuais conflitos podem ser levados ao foro do seu domicílio.</p>
      </Section>
    </LegalPage>
  );
}
