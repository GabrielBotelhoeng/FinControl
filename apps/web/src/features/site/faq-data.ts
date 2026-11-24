/** Perguntas do site (seção 3.9 da spec), usadas pelo acordeão e pelo JSON-LD `FAQPage` do `index.html`. */
export const FAQ: { question: string; answer: string }[] = [
  {
    question: 'O FinControl é grátis?',
    answer:
      'Sim. Hoje todos os recursos estão liberados de graça. No futuro, o plano Completo, com o assistente de IA e os relatórios, vai ter uma assinatura barata; o básico do dia a dia continua grátis.',
  },
  {
    question: 'Preciso instalar alguma coisa?',
    answer:
      'Não. O FinControl funciona no navegador do celular e do computador. Se quiser, instale pela tela inicial para abrir como um app, sem passar pela loja.',
  },
  {
    question: 'Meus dados ficam seguros?',
    answer:
      'Ficam num servidor em São Paulo, e cada consulta é filtrada pela sua conta: ninguém vê os lançamentos de outra pessoa. Não vendemos nem usamos seus dados para anúncios.',
  },
  {
    question: 'Funciona no iPhone?',
    answer: 'Sim, pelo Safari. Para usar como app, toque em Compartilhar e depois em "Adicionar à Tela de Início".',
  },
  {
    question: 'Consigo importar o extrato do banco?',
    answer:
      'Sim. Envie o arquivo OFX ou CSV que o seu banco gera: o FinControl sugere as categorias, marca o que já foi lançado e mostra tudo antes de importar.',
  },
  {
    question: 'Posso apagar tudo?',
    answer: 'Pode. Em Perfil, "Excluir minha conta" apaga a conta e todos os seus dados na hora, como manda a LGPD.',
  },
  {
    question: 'Como a demo funciona?',
    answer:
      'Você entra sem cadastro, com dados de exemplo já lançados, para mexer à vontade. A demo é apagada depois de 7 dias; para guardar os seus dados, crie uma conta.',
  },
];
