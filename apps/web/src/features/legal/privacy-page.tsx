import { DocLink, LegalPage, List, MailLink, Section } from './legal-layout';

const UPDATED_AT = '12 de novembro de 2026';
const mail = <MailLink />;

/** Página pública (fora do login), exigida pelo Google para publicar o login OAuth. */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      meta={`Última atualização: ${UPDATED_AT}`}
      intro={
        <>
          O FinControl é um app de controle financeiro pessoal, mantido por um desenvolvedor independente. Esta página explica, em linguagem
          direta, quais dados o app trata, para quê e como você controla esses dados, conforme a Lei Geral de Proteção de Dados (LGPD, Lei nº
          13.709/2018). O uso do app também segue os <DocLink to="/termos">Termos de Uso</DocLink>.
        </>
      }
    >
      <Section title="Para quem é o FinControl">
        <p>
          O FinControl é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de menores de idade; se identificarmos uma
          conta de menor, ela será excluída.
        </p>
      </Section>

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
          serviço seguro. Não vendemos, não alugamos e não usamos seus dados para anúncios ou para treinar modelos de inteligência
          artificial.
        </p>
        <p>Cada finalidade tem uma base legal na LGPD:</p>
        <List>
          <li>
            <strong>Conta, finanças e demonstração:</strong> execução do serviço que você solicitou (art. 7º, V).
          </li>
          <li>
            <strong>Segurança:</strong> registros técnicos mínimos e limite de requisições por endereço IP, para evitar abusos e
            proteger as contas, com base no legítimo interesse (art. 7º, IX), sem uso para nenhuma outra finalidade.
          </li>
        </List>
      </Section>

      <Section title="Com quem compartilhamos">
        <p>Somente com os provedores que operam o app, cada um limitado ao necessário:</p>
        <List>
          <li>
            <strong>Supabase:</strong> banco de dados e autenticação, com os dados hospedados em São Paulo (Brasil).
          </li>
          <li>
            <strong>Vercel:</strong> hospedagem do site e da API. A API roda na região de São Paulo (Brasil); a rede de entrega do site e
            os registros técnicos da Vercel podem ser processados fora do Brasil, principalmente nos Estados Unidos, conforme o contrato de
            tratamento de dados da Vercel.
          </li>
          <li>
            <strong>Google:</strong> apenas se você usar o login com Google. Essa etapa acontece nos servidores do Google, que podem ficar
            fora do Brasil.
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
    </LegalPage>
  );
}
