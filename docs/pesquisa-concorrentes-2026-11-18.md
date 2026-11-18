# Pesquisa: apps de finanças pessoais (2026-11-18)

O que os concorrentes têm e o FinControl ainda não tem. Serve de entrada para os próximos sub-projetos.

**Fontes:** comparativos de 2026 da Serasa, Mobills, ZapGastos, Forbes Advisor, NerdWallet, The College Investor e FinanceAIDaily, além das páginas de recursos da Monarch, do YNAB e da Copilot Money.

## Quem foi olhado

| App | País | Destaque |
|---|---|---|
| Mobills | Brasil | O plano grátis mais completo para lançar à mão. Tem Open Finance no Premium, subcategorias, tags e exportação para Excel, PDF e CSV. |
| Organizze | Brasil | Interface limpa, controle para casais, Open Finance, conciliação bancária e tags. Funciona offline. |
| Minhas Economias | Brasil | Gratuito, com importação de extrato, indicadores (CDI, poupança, dólar e Ibovespa) e comparativo de fundos. |
| ZapGastos, GranaZen, Pierre e Poupa.ai | Brasil | Lançamento **pelo WhatsApp** por texto, áudio ou foto do comprovante. Alguns conectam bancos pelo Open Finance. |
| Monarch Money | EUA | **Patrimônio líquido** (contas, investimentos, imóveis e veículos menos as dívidas), painel com blocos que a pessoa reorganiza, recorrências detectadas sozinhas, calendário de contas, diagrama de Sankey do fluxo de caixa, regras de categorização, uso em casal e chat com IA. |
| YNAB | EUA | Orçamento base zero, "idade do dinheiro", sobra do orçamento que passa para o mês seguinte e **simulador de quitação** de um empréstimo (pagar a mais adianta a data e corta juros). Para comparar estratégias entre várias dívidas, o próprio YNAB indica calculadoras externas. Até 6 pessoas no mesmo orçamento. |
| Copilot Money | EUA | Considerado o melhor design do setor (finalista do Apple Design Award 2024). Categorização por IA com nível de confiança, revisão de lançamentos deslizando o dedo, resumo do mês e do ano. |

## O que o FinControl já tem e muitos não têm

- **Taxa real** do empréstimo e comparação com o Banco Central.
- **Saúde financeira** com a conta que gerou cada número.
- **Planilha de análise** com fórmulas.
- **Dívidas com credores**: negociações, acordo e juros separados.
- **Demo isolada** por visitante.
- **Assistente com IA** que lê os dados da pessoa.

## Funções que faltam (por valor para o usuário)

| # | Função | Quem tem | Esforço | Observação |
|---|---|---|---|---|
| 1 | **Planejador de quitação** (avalanche × bola de neve, juntando cartão, empréstimos e credores, com a data de quitação e os juros de cada estratégia) | YNAB (só um empréstimo por vez) e calculadoras avulsas | Médio | Cartão e empréstimo já têm saldo e taxa. A dívida com credor sem acordo não tem taxa nem parcela: o planejador precisa pedir a taxa (ou usar a do cheque especial como premissa) e quanto a pessoa pode pagar por mês. Fecha o item "sugestões de quitação" da seção 08 da ideia original. |
| 2 | **Patrimônio líquido** (bens como imóvel, carro e investimentos, menos as dívidas) com a evolução mês a mês | Monarch | Médio | Uma tabela de bens com o valor atualizado à mão. O relatório já tem as dívidas por mês. |
| 3 | **Calendário de contas** (vencimentos do mês num calendário: pendentes, faturas e parcelas) | Monarch, Fast Budget | Baixo | Só tela: os dados já existem. |
| 4 | **Assinaturas e recorrências detectadas** ("você paga R$ 39,90 todo mês para X") | Monarch, Copilot, Simplifi | Médio | Agrupa por descrição e valor parecido. A planilha "Onde o dinheiro vai" já faz parte disso. |
| 5 | **Importar extrato** (OFX ou CSV do banco), com a sugestão de categoria pela descrição e regras ("sempre que aparecer UBER, é Transporte") | Mobills, Minhas Economias, Organizze, Monarch | Médio | É a ponte barata até o Open Finance. |
| 6 | **Tags e subcategorias** | Mobills, Organizze, Monarch | Médio | Exige migration e mudança em filtros, relatórios e planilha. |
| 7 | **Comprovante anexado** ao lançamento (foto ou PDF) | Organizze e os apps de WhatsApp | Médio | Precisa de armazenamento (Supabase Storage) e dos cuidados da LGPD. |
| 8 | **Resumo do mês** (uma página com o maior gasto, o que mudou, a meta que andou e a dica) e **retrospectiva do ano** | Copilot | Baixo | Pode usar o assistente com IA, ou ser feito sem IA. |
| 9 | **Diagrama de Sankey** (receitas → categorias) nos relatórios | Monarch | Baixo | Só tela. |
| 10 | **Conta compartilhada** (casal ou família vendo os mesmos dados) | Monarch, YNAB, Organizze | Alto | Muda o modelo de dados inteiro, que hoje é um dono por linha. |
| 11 | **Lançar pelo WhatsApp** (texto, áudio e foto) | ZapGastos, GranaZen, Pierre | Alto | Exige a API oficial do WhatsApp (Meta). Desde 1º/7/2025 a Meta cobra por mensagem de modelo enviada. As respostas dentro de 24 h depois da mensagem da pessoa (janela de atendimento) não são cobradas. |
| 12 | **Open Finance** (sincronizar bancos) | Mobills, Organizze, Pierre | Alto | Exige um agregador pago (Pluggy, Belvo). Para um projeto de portfólio, a importação de extrato (item 5) dá quase o mesmo efeito. |

## Design: o que os melhores fazem

- **Painel personalizável** (Monarch): a pessoa escolhe e reordena os blocos.
- **Revisão rápida de lançamentos** (Copilot): o que entrou novo aparece numa fila, e a pessoa confirma ou corrige a categoria deslizando o dedo.
- **Animações curtas e "satisfatórias"** ao concluir algo (Copilot), como pagar uma conta, bater uma meta ou quitar uma dívida.
- **Primeiro acesso guiado** (onboarding): criar a 1ª conta, o 1º lançamento e a 1ª meta, com uma barra de progresso. Hoje o FinControl abre o painel vazio.
- **Widgets na tela inicial do celular** e **atalhos** (Mobills e Organizze). Num PWA, dá para ter atalhos no ícone (`shortcuts` do manifest), como "Nova despesa".
- **Modo escuro bem cuidado** (todos). O FinControl já tem tema claro, escuro e do sistema.

## Recomendação

Os próximos três, nesta ordem:

1. **Planejador de quitação.** Usa as dívidas que acabaram de entrar e fecha o último item da ideia original.
2. **Calendário de contas e resumo do mês.** São baratos e aparecem bem no portfólio.
3. **Importação de extrato (OFX ou CSV) com regras de categoria.** É o maior ganho de uso diário sem pagar agregador.
