"use client";

import { useState, useMemo } from "react";
import {
  FiSearch,
  FiX,
  FiChevronDown,
  FiShoppingBag,
  FiGrid,
  FiPrinter,
  FiMessageSquare,
  FiSettings,
  FiHelpCircle,
  FiBox,
  FiZap,
  FiSlash,
  FiTerminal,
  FiBellOff,
  FiShield,
  FiHash,
  FiSkipForward,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category =
  | "todos"
  | "pedidos"
  | "dashboard"
  | "impressora"
  | "chat"
  | "estoque"
  | "sistema"
  | "dev";

interface Article {
  id: string;
  category: Exclude<Category, "todos">;
  title: string;
  summary: string;
  content: React.ReactNode;
  bodyText?: string;
  ownerOnly?: boolean;
}

// ── Dev flags ─────────────────────────────────────────────────────────────────

const DEV_FLAGS = [
  {
    icon: <FiSlash size={13} />,
    label: "Desativar logs",
    description:
      "Ignora todas as chamadas de log (nada é gravado no Firestore).",
  },
  {
    icon: <FiTerminal size={13} />,
    label: "Logs no console",
    description: "Redireciona logs para console.log em vez do Firestore.",
  },
  {
    icon: <FiBellOff size={13} />,
    label: "Desativar toasts",
    description:
      "Suprime notificações de sucesso/info/warning (erros continuam).",
  },
  {
    icon: <FiShield size={13} />,
    label: "Bypass de permissões",
    description:
      "Ignora checagens de can() — simula acesso total independente da role.",
  },
  {
    icon: <FiHash size={13} />,
    label: "Mostrar IDs do Firestore",
    description:
      "Exibe os IDs dos documentos nos cards de itens, pedidos e usuários.",
  },
  {
    icon: <FiSkipForward size={13} />,
    label: "Pular confirmações",
    description:
      "Executa ações destrutivas (excluir, cancelar, fechar expediente) sem modal.",
  },
  {
    icon: <FiUsers size={13} />,
    label: "Simular perfil",
    description:
      "Substitui suas permissões pelas de um perfil cadastrado, ignorando isOwner.",
  },
];

// ── Article content ────────────────────────────────────────────────────────────

const ARTICLES: Article[] = [
  // ── PEDIDOS ──
  {
    id: "criar-pedido",
    category: "pedidos",
    title: "Criar um pedido manualmente",
    summary: "Como abrir um novo pedido diretamente pelo painel admin.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na página de <B>Pedidos</B>, clique no botão <B>Novo Pedido</B> no
          canto superior direito. Uma janela vai abrir com o formulário.
        </P>
        <P>Preencha:</P>
        <List
          items={[
            "Nome do cliente",
            "Telefone (opcional, usado para contato via WhatsApp)",
            "Número da vaga",
            "Itens do pedido — clique em cada item para configurar quantidade, adicionais e observações",
          ]}
        />
        <P>
          Clique em <B>Criar Pedido</B> para confirmar. O pedido aparece
          imediatamente no painel de pedidos ativos.
        </P>
        <Note>
          Apenas usuários com permissão <code>create_order</code> conseguem
          abrir novos pedidos.
        </Note>
      </div>
    ),
  },
  {
    id: "finalizar-pedido",
    category: "pedidos",
    title: "Finalizar um pedido",
    summary: "Como registrar o pagamento e concluir um pedido.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No card do pedido ativo, clique em <B>Finalizar</B>. Um modal de
          pagamento vai abrir.
        </P>
        <P>No modal:</P>
        <List
          items={[
            "Informe o valor recebido em cada forma de pagamento (Débito, Crédito, Dinheiro, Pix)",
            "Se necessário, adicione um desconto no campo Desconto",
            "Marque se a taxa de serviço foi paga",
            "O campo Falta mostra quanto ainda falta — clique nele para copiar o valor",
            "Se informar dinheiro a mais, o sistema calcula o troco automaticamente",
          ]}
        />
        <P>
          Clique em <B>Finalizar Pedido</B>. Se os valores não baterem
          exatamente, o sistema pedirá uma confirmação extra antes de finalizar.
        </P>
        <Note>
          Pedidos finalizados são movidos para a aba <B>Finalizados</B> e podem
          ser reativados se necessário.
        </Note>
      </div>
    ),
  },
  {
    id: "cancelar-pedido",
    category: "pedidos",
    title: "Cancelar um pedido",
    summary: "Como cancelar um pedido ativo.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No card do pedido ativo, clique em <B>Cancelar</B>. Um modal de
          confirmação vai aparecer.
        </P>
        <P>
          Confirme o cancelamento. O pedido é movido para a aba{" "}
          <B>Finalizados</B> com status <B>Cancelado</B> (em vermelho).
        </P>
        <P>
          O estoque dos itens é <B>devolvido automaticamente</B> após o
          cancelamento.
        </P>
        <Note>
          Pedidos cancelados podem ser reativados usando o botão de ↺ reativar
          na aba Finalizados.
        </Note>
      </div>
    ),
  },
  {
    id: "reativar-pedido",
    category: "pedidos",
    title: "Reativar um pedido",
    summary: "Como voltar um pedido finalizado ou cancelado para ativo.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na aba <B>Finalizados</B>, encontre o pedido desejado. No canto do
          card, clique no ícone de <B>↺ reativar</B>.
        </P>
        <P>
          Uma confirmação rápida vai aparecer no próprio card. Clique em{" "}
          <B>Sim</B>.
        </P>
        <P>
          O pedido volta para a aba <B>Ativos</B> com o status original, sem
          pagamento registrado. O estoque é reduzido novamente.
        </P>
        <Note>
          Use reativar quando um pagamento for registrado errado ou quando o
          cliente pedir uma alteração no pedido já finalizado.
        </Note>
      </div>
    ),
  },
  {
    id: "editar-pedido",
    category: "pedidos",
    title: "Editar um pedido ativo",
    summary: "Como adicionar, remover ou alterar itens de um pedido em aberto.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No card do pedido ativo, clique no ícone de <B>✏️ lápis</B> no canto
          do card.
        </P>
        <P>
          O mesmo modal de novo pedido vai abrir, já preenchido com os dados
          atuais. Faça as alterações necessárias e clique em{" "}
          <B>Salvar alterações</B>.
        </P>
        <Note>
          Apenas usuários com permissão <code>edit_orders</code> podem editar
          pedidos.
        </Note>
      </div>
    ),
  },
  {
    id: "imprimir-comanda",
    category: "pedidos",
    title: "Imprimir uma comanda",
    summary: "Como imprimir o ticket de um pedido na impressora térmica.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Com a impressora conectada (ver seção <B>Impressora</B>), cada card de
          pedido ativo mostra um ícone de impressora no cabeçalho.
        </P>
        <P>
          Clique nesse ícone para imprimir a comanda. O ticket impresso contém:
          número da comanda, vaga, data/hora, cliente, itens com preços,
          subtotal, taxa e total.
        </P>
        <P>
          Cards com o badge <B>Não impresso</B> indicam pedidos que ainda não
          foram impressos desde a conexão.
        </P>
        <P>
          Na aba <B>Finalizados</B>, você pode reimprimir comandas de pedidos
          encerrados clicando no ícone de impressora no card.
        </P>
        <Note>
          A impressora precisa estar conectada via USB Serial ou QZ Tray para o
          botão aparecer.
        </Note>
      </div>
    ),
  },
  {
    id: "chat-cliente",
    category: "pedidos",
    title: "Chat com o cliente",
    summary: "Como enviar e receber mensagens do cliente em tempo real.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No card de cada pedido, clique no ícone de <B>💬 balão</B>. Um painel
          de chat vai abrir na lateral direita da tela.
        </P>
        <P>
          As mensagens chegam em tempo real. Quando há uma mensagem não lida, o
          ícone fica vermelho com animação pulsante e um som de notificação é
          tocado.
        </P>
        <P>
          Para enviar mensagens prontas rapidamente, digite <B>/</B> no campo de
          texto — uma lista de templates disponíveis vai aparecer. Use as setas
          ↑↓ para navegar e Enter para selecionar.
        </P>
        <P>
          Você pode formatar o texto com os botões da barra de formatação
          (negrito, itálico, sublinhado).
        </P>
        <P>
          Se o cliente permitir as notificações, toda vez que você enviar uma
          mensagem e ele não estiver na tela do site do Cinema, ele irá receber
          uma mensagem por notificação em seu celular.
        </P>
        <Warn>
          Se o pedido estiver finalizado ou cancelado, um aviso amarelo aparece
          informando que o cliente pode não ver novas mensagens.
        </Warn>
      </div>
    ),
  },
  {
    id: "filtros-pedidos",
    category: "pedidos",
    title: "Filtros e ordenação de pedidos",
    summary: "Como usar os filtros na página de pedidos.",
    content: (
      <div className="flex flex-col gap-3">
        <P>Na página de pedidos, há dois campos de filtro:</P>
        <List
          items={[
            "Filtrar por vaga — mostra apenas pedidos da vaga digitada",
            "Número do pedido — busca pelo número da comanda",
          ]}
        />
        <P>
          Para pedidos ativos, você pode ordenar por: <B>Mais recente</B>,{" "}
          <B>Mais antigo</B>, <B>Vaga</B> ou <B>Valor</B>.
        </P>
        <P>
          Para pedidos finalizados, há filtros adicionais de status (Todos /
          Finalizados / Cancelados) e de data (Hoje / Ontem / Data específica).
        </P>
      </div>
    ),
  },
  {
    id: "numeracao-comandas",
    category: "pedidos",
    title: "Numeração das comandas",
    summary: "Como funciona o número de cada pedido.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Cada pedido recebe um número sequencial gerado automaticamente,
          começando do <B>#1</B> a cada expediente.
        </P>
        <P>
          O contador é armazenado no Firestore (coleção{" "}
          <code>counters/orders</code>) e é incrementado de forma atômica — dois
          pedidos simultâneos nunca recebem o mesmo número.
        </P>
        <P>
          O número é <B>reiniciado ao fechar o expediente</B> no Dashboard. Se o
          expediente não for fechado, a numeração continua crescendo.
        </P>
      </div>
    ),
  },

  // ── DASHBOARD ──
  {
    id: "cards-stats",
    category: "dashboard",
    title: "Cards de estatísticas",
    summary: "O que cada card no topo do Dashboard representa.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Os 6 cards no topo do Dashboard mostram dados dos pedidos{" "}
          <B>ainda não arquivados</B> (pendentes de fechamento de expediente):
        </P>
        <List
          items={[
            "Pedidos ativos — pedidos em aberto no momento",
            "Finalizados — pedidos concluídos desde o último fechamento",
            "Cancelados — pedidos cancelados desde o último fechamento",
            "Faturamento — receita total dos pedidos finalizados",
            "Ticket médio — faturamento ÷ pedidos finalizados",
            "Taxa de cancelamento — % de pedidos cancelados sobre o total",
          ]}
        />
        <Note>
          Esses números são zerados ao fechar o expediente, pois os pedidos são
          arquivados nas estatísticas diárias.
        </Note>
      </div>
    ),
  },
  {
    id: "abrir-fechar-loja",
    category: "dashboard",
    title: "Abrir e fechar a lanchonete",
    summary: "Como controlar se o público pode fazer pedidos.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No Dashboard, na seção <B>Controle da Lanchonete</B>, use o toggle
          para abrir ou fechar a lanchonete para pedidos.
        </P>
        <P>
          Quando fechada, o app do cliente exibe uma mensagem informando que não
          está aceitando pedidos.
        </P>
        <P>
          O status aparece também na <B>barra lateral do admin</B> com um ponto
          colorido (verde = aberta, vermelho = fechada) em tempo real.
        </P>
        <P>
          Os horários de funcionamento exibidos no app podem ser configurados
          nos campos <B>Abertura</B> e <B>Fechamento</B> na mesma seção.
        </P>
      </div>
    ),
  },
  {
    id: "fechar-expediente",
    category: "dashboard",
    title: "Fechar o expediente",
    summary: "Como arquivar os pedidos do dia e gerar estatísticas.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Ao fim de cada dia de operação, vá ao Dashboard e clique em{" "}
          <B>Fechar Expediente</B>.
        </P>
        <P>O sistema vai:</P>
        <List
          items={[
            "Agrupar todos os pedidos finalizados e cancelados por data",
            "Salvar as estatísticas do dia em dailyStats",
            "Excluir os pedidos e suas mensagens da fila",
            "Reiniciar o contador de numeração para #1",
            "Atualizar os gráficos do Dashboard",
          ]}
        />
        <P>
          Se você esqueceu de fechar no dia anterior, pode fechar no dia
          seguinte sem problema — cada pedido é atribuído ao dia em que foi
          criado (pedidos antes das 2h da manhã contam como o dia anterior).
        </P>
        <Warn>
          Pedidos <B>ativos</B> nunca são afetados pelo fechamento — apenas
          finalizados e cancelados são arquivados.
        </Warn>
      </div>
    ),
  },
  {
    id: "relatorio-pdf",
    category: "dashboard",
    title: "Relatório em PDF",
    summary: "Como gerar e baixar um relatório do período.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No Dashboard, na seção <B>Relatório em PDF</B>, selecione o período
          desejado nos campos <B>De</B> e <B>Até</B> (por padrão já vem com o
          dia atual).
        </P>
        <P>
          Clique em <B>Baixar PDF</B>. O arquivo gerado contém:
        </P>
        <List
          items={[
            "Cabeçalho com o período",
            "Resumo: pedidos finalizados e cancelados",
            "Faturamento por forma de pagamento (Dinheiro, Pix, Crédito, Débito)",
            "Descontos concedidos",
            "Total geral",
            "Lista dos itens mais vendidos",
            "Detalhamento por dia (se o período for maior que um dia)",
          ]}
        />
        <Note>
          Se o dia atual ainda não foi arquivado, os pedidos pendentes são
          incluídos automaticamente com uma nota no PDF.
        </Note>
      </div>
    ),
  },
  {
    id: "graficos",
    category: "dashboard",
    title: "Gráficos históricos",
    summary: "Como interpretar e filtrar os gráficos do Dashboard.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Os gráficos são preenchidos após cada fechamento de expediente. Há 4
          gráficos:
        </P>
        <List
          items={[
            "Faturamento por dia — linha mostrando total e subtotal ao longo do tempo",
            "Pedidos finalizados vs cancelados — barras comparativas por dia",
            "Itens mais vendidos — barras horizontais com os top 8 itens do período",
            "Distribuição por pagamento — pizza mostrando % de cada forma de pagamento",
          ]}
        />
        <P>
          Cada gráfico tem filtros de data independentes. Você pode selecionar
          intervalos diferentes para cada um.
        </P>
        <P>
          Usuários com permissão de exclusão podem apagar dados de períodos
          específicos usando o ícone de lixeira em cada gráfico.
        </P>
      </div>
    ),
  },
  {
    id: "usuarios-ativos",
    category: "dashboard",
    title: "Usuários ativos no app",
    summary: "Como ver quantas pessoas estão no app do cliente agora.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No Dashboard e na barra lateral, é exibido em tempo real quantas
          pessoas estão com o app do cliente aberto naquele momento.
        </P>
        <P>
          O contador usa o Firebase Realtime Database — cada aba/sessão aberta
          conta como uma presença. Quando a pessoa fecha o app, a presença é
          removida automaticamente.
        </P>
        <P>
          Na barra lateral, o número aparece discretamente à direita do status
          da lanchonete (ex: <B>3 no app</B>), visível somente quando há ao
          menos 1 pessoa.
        </P>
      </div>
    ),
  },

  // ── IMPRESSORA ──
  {
    id: "modos-conexao",
    category: "impressora",
    title: "Modos de conexão: USB Serial vs QZ Tray",
    summary: "Diferença entre os dois modos de impressão disponíveis.",
    content: (
      <div className="flex flex-col gap-3">
        <P>O sistema suporta dois modos de conexão com a impressora térmica:</P>
        <List
          items={[
            "USB Serial — conexão direta pelo navegador usando a Web Serial API. Funciona no Google Chrome e Microsoft Edge. Não requer instalação de software adicional.",
            "QZ Tray — usa um aplicativo instalado no computador (QZ Tray) para intermediar a impressão. Funciona em qualquer navegador e é recomendado para uso em produção.",
          ]}
        />
        <P>
          Para escolher o modo, use o seletor na barra de impressão no topo da
          página de <B>Pedidos</B> (visível apenas em telas maiores).
        </P>
        <Note>
          A barra de impressão é ocultada em celulares — a impressão está
          disponível apenas no desktop/notebook.
        </Note>
      </div>
    ),
  },
  {
    id: "configurar-qztray",
    category: "impressora",
    title: "Configurar o QZ Tray",
    summary: "Passo a passo para conectar a impressora via QZ Tray.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          O tutorial completo de configuração do QZ Tray está disponível
          diretamente no painel:
        </P>
        <List
          items={[
            "Vá até a página de Pedidos",
            'Selecione "QZ Tray" no seletor de modo da barra de impressão',
            'Clique no botão azul "Tutorial QZ" que aparece na barra',
            "Siga os 6 passos do tutorial",
          ]}
        />
        <P>
          Em resumo: instale o QZ Tray, baixe o certificado pelo tutorial,
          copie-o para a pasta de instalação, configure o arquivo{" "}
          <code>qz-tray.properties</code> como Administrador e reinicie o QZ
          Tray.
        </P>
        <Note>
          O certificado dura 10 anos e não é vinculado ao hardware — ao trocar
          de PC, repita apenas os passos de configuração (não precisa gerar novo
          certificado).
        </Note>
      </div>
    ),
  },
  {
    id: "configurar-serial",
    category: "impressora",
    title: "Configurar USB Serial",
    summary: "Como conectar a impressora diretamente via USB no navegador.",
    content: (
      <div className="flex flex-col gap-3">
        <P>Requisitos:</P>
        <List
          items={[
            "Google Chrome ou Microsoft Edge (outros navegadores não suportam Web Serial API)",
            "Impressora térmica ESC/POS conectada via USB",
          ]}
        />
        <P>Passos:</P>
        <List
          items={[
            'Selecione "USB Serial" no seletor de modo',
            'Clique em "Conectar impressora"',
            "Uma janela do navegador vai aparecer listando as portas seriais disponíveis",
            "Selecione a porta correspondente à sua impressora e clique em Conectar",
          ]}
        />
        <Warn>
          Se aparecer um aviso de que o dispositivo pode ser um adaptador
          USB-Serial (FTDI, CH340, etc.), a impressão pode não funcionar
          corretamente. Conecte a impressora diretamente via USB, sem
          adaptadores.
        </Warn>
      </div>
    ),
  },
  {
    id: "pagina-teste",
    category: "impressora",
    title: "Imprimir página de teste",
    summary: "Como verificar se a impressora está funcionando.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Com a impressora conectada, clique no botão <B>Teste</B> na barra de
          impressão.
        </P>
        <P>Uma folha será impressa com:</P>
        <List
          items={[
            '"Ola, Cine Drive-in!" em destaque',
            '"Impressão de teste"',
            'Uma "Curiosidade do dia" — uma curiosidade aleatória sobre drive-ins ao redor do mundo',
            '"Impressora conectada com sucesso"',
          ]}
        />
        <P>
          A curiosidade muda a cada clique — há 15 curiosidades disponíveis
          sorteadas aleatoriamente.
        </P>
      </div>
    ),
  },

  // ── CHAT ──
  {
    id: "templates-chat",
    category: "chat",
    title: "Mensagens prontas (templates)",
    summary: "Como usar e criar mensagens prontas no chat.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No chat de qualquer pedido, digite <B>/</B> para abrir a lista de
          mensagens prontas. Um painel vai aparecer com todos os templates
          disponíveis.
        </P>
        <P>
          Use <B>↑↓</B> para navegar, <B>Enter</B> ou <B>Tab</B> para
          selecionar. Você também pode digitar após o <B>/</B> para filtrar por
          nome ou trigger (ex: <code>/confirmado</code>).
        </P>
        <P>
          Para <B>criar ou editar templates</B>, clique no botão{" "}
          <B>Mensagens</B> na página de Pedidos (canto superior direito). Na
          janela que abre, você pode:
        </P>
        <List
          items={[
            "Ver todos os templates existentes com prévia da mensagem",
            "Criar novos templates com trigger, título e mensagem",
            "Editar ou excluir templates existentes",
            "Usar formatação: **negrito**, _itálico_, __sublinhado__, # Título, ## Subtítulo",
          ]}
        />
        <Note>
          O trigger é o atalho que o operador digita após a / (ex: trigger
          {'"'}confirmado{'"'} → digitar /confirmado). Use apenas letras
          minúsculas e números, sem espaços.
        </Note>
      </div>
    ),
  },
  {
    id: "formatacao-chat",
    category: "chat",
    title: "Formatação de mensagens",
    summary: "Como usar negrito, itálico e outros formatos nas mensagens.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Tanto no chat quanto nos templates, você pode usar formatação Markdown
          simples:
        </P>
        <List
          items={[
            "**texto** → negrito",
            "_texto_ → itálico",
            "__texto__ → sublinhado",
            "# Título → título grande (H1)",
            "## Subtítulo → subtítulo médio (H2)",
          ]}
        />
        <P>
          Os títulos com <B>#</B> e <B>##</B> são úteis para organizar mensagens
          longas, como cardápios ou listas de opções. Digite o símbolo no início
          da linha seguido de um espaço.
        </P>
        <P>
          Ou use os botões da barra de formatação acima do campo de texto para
          formatar o texto selecionado automaticamente.
        </P>
        <P>
          A prévia da mensagem aparece em tempo real na tela de criação de
          templates.
        </P>
      </div>
    ),
  },

  // ── ESTOQUE ──
  {
    id: "estoque-itens",
    category: "estoque",
    title: "Adicionar e editar itens do cardápio",
    summary: "Como criar, editar e organizar os itens disponíveis para pedido.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na página <B>Estoque</B>, você verá a lista de todos os itens do
          cardápio. Para adicionar um novo item, clique em <B>Novo Item</B>.
        </P>
        <P>Cada item tem os seguintes campos:</P>
        <List
          items={[
            "Nome — nome que aparece no cardápio e nas comandas",
            "Código (codItem) — identificador único curto usado nos relatórios",
            "Categoria — agrupa os itens no cardápio (ex: Lanches, Bebidas, Sobremesas)",
            "Descrição — texto opcional exibido no cardápio do cliente",
            "Valor real — preço cobrado internamente (usado nos relatórios)",
            "Valor visível — preço exibido ao cliente caso não esteja zerado (pode ser diferente do real)",
            "Foto — imagem exibida no cardápio",
          ]}
        />
        <P>
          Para editar um item existente, clique no ícone de <B>lápis</B> na
          linha do item.
        </P>
        <Note>
          A categoria dos itens pode ser reordenada arrastando as categorias na
          seção de configuração de ordem do cardápio.
        </Note>
      </div>
    ),
  },
  {
    id: "controle-estoque",
    category: "estoque",
    title: "Controle de estoque",
    summary: "Como ativar o rastreamento de quantidade de um item.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          O controle de estoque permite rastrear a quantidade disponível de cada
          item. Quando a quantidade chega a zero, o item é automaticamente
          indisponibilizado no cardápio do cliente.
        </P>
        <P>Para ativar o controle em um item:</P>
        <List
          items={[
            "Edite o item desejado",
            'Ative o toggle "Controlar estoque"',
            "Informe a quantidade atual disponível",
            "Salve o item",
          ]}
        />
        <P>
          A quantidade é <B>decrementada automaticamente</B> quando um pedido é
          criado com esse item, e <B>incrementada</B> quando o pedido é
          cancelado ou reativado.
        </P>
        <Warn>
          Itens com estoque zerado ficam cinza e indisponíveis no app do
          cliente. Reponha o estoque editando o item e atualizando a quantidade.
        </Warn>
      </div>
    ),
  },
  {
    id: "subitens",
    category: "estoque",
    title: "Subitens e adicionais",
    summary: "O que são subitens e como criá-los para vincular aos itens.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Subitens são as <B>opções extras</B> que o cliente pode escolher ao
          pedir um item — como molhos, bebidas, doces ou outros adicionais.
        </P>
        <P>
          Para criar um subitem, vá até a aba <B>Subitens</B> na página de
          Estoque e clique em <B>Novo Subitem</B>. Informe o nome (ex:{" "}
          <code>Grill</code>, <code>Coca-Cola</code>, <code>Sorvete</code>).
        </P>
        <Note>
          Subitens são apenas nomes — eles não têm preço ou estoque próprio. O
          preço do adicional já está incluso no valor do item principal.
        </Note>
      </div>
    ),
  },
  {
    id: "vincular-subitens",
    category: "estoque",
    title: "Vincular um subitem a um item do estoque",
    summary:
      "Como fazer um adicional consumir automaticamente o estoque de um item.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Ao <B>criar ou editar um subitem</B>, há um campo para vinculá-lo a um
          item do sistema. Essa vinculação serve para controle de estoque
          automático.
        </P>
        <P>
          <B>Como funciona:</B> se o item vinculado tiver o controle de estoque
          ativado, toda vez que esse subitem for selecionado em um pedido, o
          sistema desconta <B>1 unidade</B> do estoque do item vinculado
          automaticamente.
        </P>
        <P>Exemplo prático:</P>
        <List
          items={[
            'O subitem "Coca-Cola" é criado e vinculado ao item "Coca-Cola Lata" do estoque',
            'O item "Coca-Cola Lata" tem controle de estoque ativo com 30 unidades',
            "Um cliente pede um hamburguer com o adicional Coca-Cola",
            'O estoque de "Coca-Cola Lata" cai automaticamente para 29',
          ]}
        />
        <P>
          Se o item vinculado <B>não tiver</B> controle de estoque ativo, a
          vinculação não tem efeito — o subitem funciona normalmente como
          adicional sem consumir estoque.
        </P>
        <Note>
          Quando um pedido é cancelado ou reativado, o estoque do item vinculado
          é devolvido automaticamente, assim como acontece com os itens
          principais do pedido.
        </Note>
      </div>
    ),
  },
  {
    id: "logs",
    category: "sistema",
    title: "Logs do sistema",
    summary: "Como acompanhar todas as ações realizadas no painel.",
    bodyText: "logs histórico auditoria ações registros restaurar recuperar",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          A página <B>Logs</B> registra todas as ações realizadas no sistema,
          com data, hora, usuário responsável e detalhes da operação.
        </P>
        <P>Exemplos de ações registradas:</P>
        <List
          items={[
            "Criação, edição, cancelamento e finalização de pedidos",
            "Abertura e fechamento da lanchonete",
            "Fechamento de expediente e arquivamento de dados",
            "Alterações no estoque e nos itens do cardápio",
            "Adição e remoção de usuários",
          ]}
        />
        <P>
          Use os filtros disponíveis para buscar por <B>categoria</B>,{" "}
          <B>usuário</B> ou <B>período</B>.
        </P>
        <P>
          Logs que registram alterações ou exclusões exibem um botão de{" "}
          <B>restauração</B> ao passar o mouse — consulte o artigo{" "}
          <B>Restaurar dados via log</B> para mais detalhes.
        </P>
        <Note>
          Logs não podem ser editados manualmente — servem como histórico de
          auditoria. Apenas usuários com permissão <code>delete_logs</code>{" "}
          podem excluí-los.
        </Note>
      </div>
    ),
  },
  {
    id: "config-site",
    category: "sistema",
    title: "Configurações do Site",
    summary: "Como configurar filmes, sessões, preços e aparência do cardápio.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          A página <B>Configurações do Site</B> controla o conteúdo exibido no
          app do cliente. As principais seções são:
        </P>
        <List
          items={[
            "Filmes em cartaz — adicione os filmes com título, classificação, sinopse e imagem",
            "Sessões — configure os horários de cada sessão (Sessão 1, 2, 3...)",
            "Preços — defina as regras de preço por tipo de ingresso (adulto, meia, etc.)",
            "Tipos de evento — configure os tipos de evento disponíveis",
            "Taxa de serviço — percentual cobrado automaticamente nos pedidos",
          ]}
        />
        <P>
          Para adicionar um filme, clique em <B>Adicionar filme</B>, preencha os
          campos e faça upload da imagem de capa. Os filmes aparecem
          imediatamente no app após salvar.
        </P>
        <P>
          As sessões são vinculadas aos filmes e exibem o horário e o filme em
          cada sessão no app.
        </P>
        <Warn>
          Alterações nas configurações do site são refletidas em tempo real no
          app do cliente — tome cuidado ao editar durante o funcionamento.
        </Warn>
      </div>
    ),
  },
  {
    id: "avaliacoes-clientes",
    category: "sistema",
    title: "Avaliações dos clientes",
    summary:
      "Como visualizar, marcar como vistas, destacar e excluir as avaliações enviadas pelo site.",
    bodyText:
      "avaliação avaliacoes feedback estrelas comentário sugestão reclamação elogio destacar favoritar excluir cliente nota opinião visto não vista badge",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na página <B>Configurações do Site</B>, a aba <B>Avaliações</B> exibe
          os comentários e notas (de 0 a 5 estrelas) enviados pelos clientes na
          página de feedback do site.
        </P>
        <P>
          As avaliações são listadas com as <B>mais recentes primeiro</B>. Nessa
          aba você pode:
        </P>
        <List
          items={[
            "Destacar uma avaliação clicando no ícone de estrela no card — avaliações destacadas sempre aparecem no topo da lista",
            "Excluir uma avaliação permanentemente clicando no ícone de lixeira",
            'Marcar uma avaliação como vista clicando em "Marcar como visto" no card',
          ]}
        />
        <P>
          Avaliações ainda não vistas são destacadas com uma borda colorida no
          card, e a aba <B>Avaliações</B> exibe um selo com a quantidade de
          avaliações não vistas.
        </P>
        <Note>
          Apenas usuários com permissão <code>manage_site_settings</code> podem
          destacar ou excluir avaliações. Marcar como vista está disponível para
          qualquer usuário com acesso a esta página. Ações de destaque, exclusão
          e marcação como vista são registradas na página de <B>Logs</B>.
        </Note>
      </div>
    ),
  },

  // ── SISTEMA ──
  {
    id: "usuarios-permissoes",
    category: "sistema",
    title: "Usuários e permissões",
    summary: "Como gerenciar acesso de cada operador ao sistema.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na página <B>Usuários</B>, o Owner pode gerenciar todos os usuários do
          sistema.
        </P>
        <P>
          Cada usuário recebe um <B>perfil de permissão</B> que define quais
          ações ele pode realizar. Os perfis são configurados na mesma página e
          podem incluir permissões como:
        </P>
        <List
          items={[
            "view_orders / create_order / edit_orders / finish_orders / cancel_orders",
            "view_dashboard / generate_report",
            "view_stock / edit_stock",
            "view_users / manage_users",
            "manage_chat_templates / chat_orders",
            "manage_store / view_site",
            "view_logs / delete_logs / restore_log",
          ]}
        />
        <P>
          O <B>Owner</B> tem acesso total e não pode ter permissões removidas.
        </P>
        <Note>
          Novos usuários precisam de aprovação do Owner antes de conseguir fazer
          login.
        </Note>
      </div>
    ),
  },
  {
    id: "status-sidebar",
    category: "sistema",
    title: "Indicadores da barra lateral",
    summary: "O que significa cada indicador na barra lateral do admin.",
    content: (
      <div className="flex flex-col gap-3">
        <P>A barra lateral exibe em tempo real:</P>
        <List
          items={[
            "Ponto verde / vermelho + texto — status da lanchonete (aberta ou fechada para pedidos)",
            "Número à direita do status (ex: 3 no app) — quantidade de sessões abertas no app do cliente naquele momento",
            "Badge vermelho no ícone de Pedidos — número de pedidos novos ainda não vistos",
          ]}
        />
        <P>
          Todos esses indicadores atualizam automaticamente sem precisar
          recarregar a página.
        </P>
      </div>
    ),
  },
  {
    id: "relatorio-diario",
    category: "dashboard",
    title: "Relatório diário no Dashboard",
    summary: "Como visualizar as estatísticas de um dia específico.",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          No Dashboard, a seção <B>Relatório Diário</B> mostra os dados de um
          dia selecionado. Use o campo de data no cabeçalho para escolher o dia.
        </P>
        <P>O relatório pode ser de dois tipos:</P>
        <List
          items={[
            "Arquivado — dia já fechado, dados fixos das estatísticas (badge roxo)",
            "Ao vivo — dia atual ainda não fechado, dados em tempo real dos pedidos (badge verde)",
          ]}
        />
        <P>
          O relatório mostra: resumo de pedidos (finalizados e cancelados),
          faturamento por forma de pagamento, descontos, total, e lista de itens
          vendidos.
        </P>
        <P>
          Se a impressora estiver conectada, você pode imprimir o relatório
          clicando em <B>Imprimir</B>.
        </P>
      </div>
    ),
  },

  // ── PEDIDOS (novos) ──
  {
    id: "alerta-sonoro",
    category: "pedidos",
    title: "Alerta sonoro de novos pedidos",
    summary: "Como ativar o som de notificação quando um pedido chega.",
    bodyText:
      "som audio alerta sonoro notificação novo pedido ativar desativar mudo silencioso volume",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na página de <B>Pedidos</B>, há um botão de som no canto inferior
          direito da tela. Clique nele para ativar ou desativar o alerta sonoro.
        </P>
        <P>
          Com o som ativo, sempre que um novo pedido chegar ao painel, um{" "}
          <B>sinal sonoro</B> é tocado automaticamente — útil em ambientes
          barulhentos ou quando o painel não está em foco.
        </P>
        <List
          items={[
            "Ícone de som ativo — alertas habilitados",
            "Ícone mudo (riscado) — alertas silenciados",
          ]}
        />
        <Note>
          A preferência de som é salva localmente no navegador. Ao reabrir a
          página, o estado anterior é restaurado automaticamente.
        </Note>
      </div>
    ),
  },
  {
    id: "acoes-massa",
    category: "pedidos",
    title: "Ações em massa nos pedidos",
    summary:
      "Como cancelar todos os ativos ou excluir todos os cancelados de uma vez.",
    bodyText:
      "cancelar todos pedidos ativos massa lote bulk excluir cancelados permanente botão",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          <B>Cancelar todos os ativos</B>
        </P>
        <P>
          Na aba <B>Ativos</B>, clique no botão <B>Cancelar todos (N)</B> no
          canto superior direito da lista. Um modal de confirmação mostrará o
          total de pedidos afetados.
        </P>
        <P>
          Todos os pedidos ativos são cancelados e movidos para{" "}
          <B>Finalizados</B>. O estoque de cada item é devolvido
          automaticamente.
        </P>
        <P>
          <B>Excluir todos os cancelados</B>
        </P>
        <P>
          Na aba <B>Finalizados</B>, clique no botão <B>Excluir cancelados</B>.
          Isso remove permanentemente todos os pedidos com status Cancelado da
          fila atual.
        </P>
        <Warn>
          A exclusão em massa é irreversível. Pedidos excluídos não aparecem
          mais nos relatórios.
        </Warn>
      </div>
    ),
  },
  {
    id: "excluir-pedido",
    category: "pedidos",
    title: "Excluir um pedido permanentemente",
    summary: "Como remover definitivamente um pedido finalizado ou cancelado.",
    bodyText:
      "excluir deletar remover pedido permanente definitivo apagar histórico lixeira",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na aba <B>Finalizados</B>, cada card tem um ícone de <B>🗑 lixeira</B>
          . Clique nele para excluir o pedido permanentemente.
        </P>
        <P>
          Uma confirmação rápida aparece no próprio card. Confirme para
          concluir.
        </P>
        <P>
          A exclusão remove o pedido <B>e todo o histórico de chat</B> associado
          a ele.
        </P>
        <Warn>
          Pedidos excluídos não podem ser recuperados e não aparecem nos
          relatórios. Use apenas para pedidos que não precisam mais constar no
          histórico.
        </Warn>
        <Note>
          Apenas usuários com permissão <code>delete_orders</code> veem o botão
          de exclusão.
        </Note>
      </div>
    ),
  },

  // ── ESTOQUE (novos) ──
  {
    id: "itens-destaque",
    category: "estoque",
    title: "Itens em destaque no cardápio",
    summary:
      "Como destacar um item para aparecer em posição privilegiada no app do cliente.",
    bodyText:
      "destaque featured estrela favorito cardápio topo prioridade item especial evidência",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na lista de itens do <B>Estoque</B>, cada item tem um ícone de{" "}
          <B>estrela</B>. Clique nele para marcar ou desmarcar o item como
          destaque.
        </P>
        <P>
          Itens marcados como destaque ficam em{" "}
          <B>evidência no cardápio do cliente</B>, sendo exibidos antes dos
          demais itens da mesma categoria.
        </P>
        <P>
          Use o destaque para promover itens sazonais, promoções ou os mais
          pedidos da casa.
        </P>
        <Note>
          O destaque não altera preço nem disponibilidade — é apenas uma forma
          de dar mais visibilidade no cardápio.
        </Note>
      </div>
    ),
  },
  {
    id: "visibilidade-itens",
    category: "estoque",
    title: "Ocultar e mostrar itens do cardápio",
    summary:
      "Como esconder temporariamente um item ou subitem sem precisar excluí-lo.",
    bodyText:
      "visibilidade ocultar esconder mostrar exibir item subitem cardápio temporário invisível inativo ativo olho",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na lista de itens e subitens do <B>Estoque</B>, cada linha tem um
          ícone de <B>olho</B>. Clique nele para alternar entre visível e
          oculto.
        </P>
        <P>
          Itens <B>ocultos</B> não aparecem no cardápio do cliente, mas
          continuam existindo no sistema e podem ser reativados a qualquer
          momento.
        </P>
        <P>Use ocultar para:</P>
        <List
          items={[
            "Itens temporariamente indisponíveis (sem estoque mas sem data de retorno)",
            "Itens sazonais fora de época",
            "Itens em reformulação antes de voltar ao cardápio",
          ]}
        />
        <Note>
          Diferente do controle de estoque (que zera automaticamente quando
          acaba), ocultar é manual — o item permanece oculto até você reativar.
        </Note>
      </div>
    ),
  },
  {
    id: "itens-promocao",
    category: "estoque",
    title: "Marcar um item como promoção",
    summary:
      "Como ativar a promoção em um item, exibir preço riscado e badge vermelho no cardápio.",
    bodyText:
      "promoção promocao desconto preço original riscado badge vermelho cardápio tag em promoção filtro",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Ao <B>editar um item</B> no Estoque, há uma seção <B>Em promoção</B>{" "}
          abaixo do campo de preço. Clique no toggle para ativar.
        </P>
        <P>Com a promoção ativa, um campo adicional aparece:</P>
        <List
          items={[
            "Preço original (antes da promoção) — o valor que será exibido riscado no cardápio do cliente",
          ]}
        />
        <P>
          Na <B>listagem do Estoque</B>, o item ganha um badge vermelho{" "}
          <B>Promoção</B> e exibe o preço original riscado abaixo do preço atual
          em vermelho.
        </P>
        <P>
          No <B>cardápio do cliente</B>, itens em promoção aparecem no{" "}
          <B>topo da categoria</B> — acima dos itens em destaque — com borda
          vermelha, etiqueta <B>🏷️ Promoção</B> e preço original riscado em
          cinza acima do preço atual em vermelho.
        </P>
        <P>
          Para filtrar apenas os itens em promoção na página de Estoque, use o
          seletor <B>Visibilidade</B> e escolha <B>Em promoção</B>.
        </P>
        <Note>
          Se o campo de preço original não for preenchido, o badge vermelho
          ainda aparece, mas sem o preço riscado.
        </Note>
      </div>
    ),
  },
  {
    id: "ordem-categorias",
    category: "estoque",
    title: "Ordenar as categorias do cardápio",
    summary:
      "Como definir a sequência de exibição das categorias no app do cliente usando drag-and-drop.",
    bodyText:
      "ordem categorias cardápio arrastar drag drop reordenar posição sequência organizar seção",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na página de <B>Estoque</B>, role até a seção <B>Ordem do cardápio</B>
          . Ela lista todas as categorias existentes em cards arrastáveis.
        </P>
        <P>
          Arraste os cards para reposicionar as categorias na ordem desejada e
          clique em <B>Salvar ordem</B> para confirmar.
        </P>
        <P>
          A nova sequência é refletida imediatamente no cardápio do cliente após
          salvar.
        </P>
        <Note>
          A ordenação afeta apenas a sequência das categorias no menu — não
          altera a ordem dos itens dentro de cada categoria.
        </Note>
      </div>
    ),
  },

  // ── IMPRESSORA (novos) ──
  {
    id: "auto-impressao",
    category: "impressora",
    title: "Auto-impressão de novas comandas",
    summary: "Como funciona a impressão automática ao receber um novo pedido.",
    bodyText:
      "auto impressão automática nova comanda pedido chega imprime automaticamente conectada badge não impresso",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Com a impressora conectada, o sistema imprime automaticamente a
          comanda sempre que um <B>novo pedido chega</B> ao painel — sem
          precisar clicar no ícone de impressão de cada card.
        </P>
        <P>
          Se um pedido chegar com a impressora <B>desconectada</B>, o card exibe
          o badge <B>Não impresso</B> em amarelo. Reconecte a impressora e
          imprima manualmente pelo ícone no card.
        </P>
        <P>
          O badge <B>Não impresso</B> desaparece assim que a comanda for
          impressa manualmente ou quando o expediente for fechado.
        </P>
        <Note>
          A auto-impressão funciona apenas enquanto a página de Pedidos está
          aberta no navegador. Se a aba for fechada ou o computador entrar em
          suspensão, novas comandas precisarão ser impressas manualmente.
        </Note>
      </div>
    ),
  },

  // ── SISTEMA (novos) ──
  {
    id: "status-cinema",
    category: "sistema",
    title: "Status do cinema e tema sazonal",
    summary:
      "Como marcar o cinema como fechado e ativar temas de Natal, Halloween e outros.",
    bodyText:
      "cinema fechado aberto status tema sazonal natal christmas halloween páscoa easter evento especial animação decoração",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na página <B>Configurações do Site</B> {"›"}{" "}
          <B>Configurações extras</B>, há dois controles de aparência do site:
        </P>
        <P>
          <B>Status do cinema</B>
        </P>
        <P>
          Diferente do controle da lanchonete no Dashboard (que abre/fecha para
          pedidos), este toggle exibe um aviso de{" "}
          <B>&quot;Cinema fechado&quot;</B> no site do cliente.
        </P>
        <P>
          Use ao final da temporada ou em períodos de manutenção — o app
          continua acessível para navegação mesmo com o aviso ativo.
        </P>
        <P>
          <B>Tema sazonal</B>
        </P>
        <P>Selecione um tema para ativar uma decoração especial no site:</P>
        <List
          items={[
            "Natal 🎄 — decoração natalina",
            "Halloween 🎃 — decoração de outubro",
            "Páscoa 🐣 — decoração de páscoa",
            "Nenhum — layout padrão",
          ]}
        />
        <Note>
          Lembre-se de clicar em <B>Salvar</B> após alterar o status ou o tema.
        </Note>
      </div>
    ),
  },
  {
    id: "popup-site",
    category: "sistema",
    title: "Pop-up de anúncio no site",
    summary:
      "Como configurar o pop-up que aparece para o cliente ao abrir o app.",
    bodyText:
      "popup pop-up anúncio banner notificação site app cliente imagem título descrição ativar desativar habilitado galeria",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Em <B>Configurações do Site</B> {"›"} <B>Configurações extras</B>{" "}
          {"›"} <B>Pop-up do site</B>, configure um anúncio que aparece
          automaticamente quando o cliente abre o app.
        </P>
        <P>Para configurar:</P>
        <List
          items={[
            "Clique em Editar na seção Pop-up do site",
            "Faça upload de uma imagem ou cole a URL diretamente",
            "Informe um título (ex: Novidades no Cine Drive-in!)",
            "Adicione descrições — cada linha vira um parágrafo no pop-up",
            "Ative o toggle Ativo para exibir o pop-up",
            "Clique em Salvar",
          ]}
        />
        <P>
          Para <B>desativar temporariamente</B> sem perder o conteúdo, basta
          comutar o toggle para <B>Inativo</B> e salvar.
        </P>
        <Note>
          Imagens enviadas ficam salvas na galeria. Reutilize-as clicando nas
          miniaturas exibidas abaixo do campo de imagem.
        </Note>
      </div>
    ),
  },
  {
    id: "meu-perfil",
    category: "sistema",
    title: "Editar meu perfil",
    summary: "Como alterar seu nome de usuário, foto e senha.",
    bodyText:
      "perfil usuario nome foto senha alterar editar username password minha conta avatar pessoal",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Acesse a página <B>Meu Perfil</B> pelo menu de navegação lateral.
        </P>
        <P>Você pode alterar:</P>
        <List
          items={[
            "Nome de usuário (username) — o @ que aparece nos logs e no chat",
            "Foto de perfil — upload de imagem ou URL externa",
            "Senha — informe a senha atual antes de definir a nova",
          ]}
        />
        <P>
          Após fazer as alterações, clique em <B>Salvar alterações</B>. Cada
          campo é salvo individualmente — você pode alterar só a foto sem mexer
          na senha, por exemplo.
        </P>
        <Note>
          Alterações no username são refletidas nos logs futuros. Logs
          anteriores continuam exibindo o nome antigo.
        </Note>
      </div>
    ),
  },
  {
    id: "versao-sistema",
    category: "sistema",
    title: "Banner de nova versão",
    summary:
      "O que fazer quando a faixa amarela de 'Nova versão disponível' aparece no painel.",
    bodyText:
      "versão atualizar banner faixa amarela nova versão disponível recarregar atualização sistema deploy publicar cache navegador fechar reabrir",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Quando uma nova versão do painel admin é publicada, uma{" "}
          <B>faixa amarela</B> aparece no topo da tela informando:{" "}
          <B>Nova versão disponível — recarregue para atualizar.</B>
        </P>
        <P>
          Clique em <B>Atualizar</B>. O sistema aguarda cerca de{" "}
          <B>3 minutos</B> para o deploy ser concluído no servidor — um spinner
          indica que está aguardando. Quando o tempo passa, o botão muda para{" "}
          <B>Recarregar</B>.
        </P>
        <P>
          Clique em <B>Recarregar</B> para carregar a nova versão. Caso prefira
          continuar trabalhando antes, clique no <B>✕</B> para fechar a faixa e
          recarregar manualmente depois.
        </P>
        <Note>
          O delay de 3 minutos existe porque o deploy leva alguns minutos para
          concluir no servidor — recarregar antes pode trazer a versão
          desatualizada.
        </Note>
        <P>
          O botão <B>Atualizar</B> já força o navegador a buscar a página mais
          recente no servidor, ignorando o cache. Se mesmo assim a faixa voltar
          a aparecer ao fechar e reabrir o navegador, o problema é o{" "}
          <B>cache do navegador</B> guardando uma cópia antiga da página.
        </P>
        <Note>
          Para limpar o cache: abra as configurações do navegador, procure por{" "}
          <B>"Limpar dados de navegação"</B> (ou <B>Ctrl + Shift + Delete</B>),
          selecione <B>"Imagens e arquivos em cache"</B> e confirme. Depois
          disso, o painel sempre carregará a versão mais recente
          automaticamente.
        </Note>
      </div>
    ),
  },
  {
    id: "tela-bloqueada",
    category: "sistema",
    title: "Trancar a tela",
    summary:
      "Como bloquear o painel sem sair da conta e desbloquear com sua senha.",
    bodyText:
      "trancar bloquear tela bloqueada senha desbloquear segurança lock painel afastou cadeado",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na <B>barra lateral</B>, no rodapé ao lado do seu perfil, clique em{" "}
          <B>Trancar</B> (ícone de cadeado).
        </P>
        <P>
          A tela é coberta imediatamente por uma sobreposição com desfoque,
          exibindo seu avatar, nome e o status <B>Tela bloqueada</B>. Nenhuma
          ação no painel é possível até que a tela seja desbloqueada.
        </P>
        <P>Para desbloquear:</P>
        <List
          items={[
            "Digite sua senha no campo exibido",
            "Clique em Desbloquear — a senha é verificada diretamente no Firebase",
            "Se a senha estiver correta, o painel volta ao estado normal",
            "Se estiver incorreta, aparece a mensagem 'Senha incorreta' e o campo é limpo",
          ]}
        />
        <P>
          Na tela de bloqueio há também o botão <B>Sair da conta</B> — use-o
          caso queira encerrar a sessão completamente ao invés de apenas
          desbloquear.
        </P>
        <Note>
          O bloqueio é salvo na sessão do navegador. Se fechar e reabrir a aba,
          a tela continuará bloqueada até a senha ser inserida.
        </Note>
      </div>
    ),
  },
  {
    id: "restauracao-logs",
    category: "sistema",
    title: "Restaurar dados via log",
    summary:
      "Como recuperar o estado anterior de um dado ou recriar itens excluídos a partir de um registro de log.",
    bodyText:
      "restaurar recuperar log desfazer histórico reverter dados excluído deletado item filme subitem quantidade preço estoque",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Na página <B>Logs</B>, registros que contêm alterações ou exclusões
          exibem um ícone de <B>restauração</B> ao passar o mouse. Clique nele
          para abrir o painel de análise antes de confirmar qualquer ação.
        </P>
        <P>O painel mostra cada campo afetado com um dos três estados:</P>
        <List
          items={[
            "Verde — restaurável: o valor anterior será gravado diretamente no banco",
            "Amarelo — parcial: o dado pode ser recuperado com ressalvas (ex.: subitem recriado, mas vínculos com itens do estoque são perdidos)",
            "Vermelho — impossível: o dado não pode ser recuperado automaticamente (ex.: imagens)",
          ]}
        />
        <P>O que pode ser restaurado:</P>
        <List
          items={[
            "Filmes excluídos — recriados na configuração do site com todos os campos salvos",
            "Itens de estoque excluídos — recriados na coleção de itens",
            "Subitens excluídos — recriados (parcial: referências em itens não são restauradas)",
            "Campos alterados: quantidade, preço, nome, visibilidade, destaque, promoção e outros",
            "Configurações do site: fechamento, tema sazonal, pop-up ativo, título e URL do pop-up",
          ]}
        />
        <P>
          O que <B>não</B> pode ser restaurado automaticamente:
        </P>
        <List
          items={[
            "Imagens — o arquivo foi substituído; a URL salva pode não corresponder ao conteúdo anterior",
            "Textos longos de pop-up (descrições) — não são armazenados no log",
            "Referências de adicionais em subitens — arrays de vínculo não são rastreados",
          ]}
        />
        <Note>
          A restauração exige a permissão <code>restore_log</code>. Sem ela, o
          botão não aparece na listagem de logs.
        </Note>
        <Warn>
          A restauração escreve diretamente no banco de dados e não pode ser
          desfeita pelo painel. Para exclusões, um novo documento é criado; para
          alterações de campo, o valor anterior é sobrescrito. A operação gera
          um log automático para fins de auditoria.
        </Warn>
      </div>
    ),
  },
  {
    id: "estatisticas-site",
    category: "sistema",
    title: "Estatísticas do site",
    summary:
      "Como interpretar cada métrica coletada sobre o comportamento dos visitantes no site público.",
    bodyText:
      "estatísticas analytics visitantes acessos cliques filmes páginas dispositivo mobile desktop sessão gráfico exportar csv período comparação",
    content: (
      <div className="flex flex-col gap-3">
        <P>
          Acesse em <B>Site → aba Estatísticas</B>. Os dados são coletados
          automaticamente a cada visita ao site público.
        </P>
        <P>
          <B>Seletor de período</B>
        </P>
        <List
          items={[
            "Hoje — dados do dia atual",
            "7 dias — últimos 7 dias",
            "14 dias — últimas duas semanas",
            "30 dias — último mês",
          ]}
        />
        <P>
          <B>Cartões de resumo (KPIs)</B>
        </P>
        <List
          items={[
            "Visitas — total de acessos únicos no período; cada sessão de navegador conta uma vez (trocar de aba e voltar não gera nova visita)",
            "Cliques em filmes — total de cliques em cards de filmes na grade de programação",
            "Filmes únicos — quantidade de filmes distintos que receberam ao menos um clique",
            "Sessões únicas — quantidade de sessões de cinema (horários) distintos que receberam cliques",
            "Cliques em páginas — total de cliques em seções do menu do site (Cardápio, Vendas Online etc.)",
            "Dispositivos — proporção de acessos por tipo (mobile × desktop)",
          ]}
        />
        <P>
          <B>Gráficos</B>
        </P>
        <List
          items={[
            "Visitas diárias — gráfico de área com a evolução de acessos dia a dia",
            "Dispositivos — pizza com a divisão mobile × desktop",
            "Cliques por filme — barras com os filmes mais clicados em ordem decrescente",
            "Cliques por sessão — barras com os horários/sessões de cinema mais acessados",
            "Cliques por página — barras com as seções do menu mais visitadas: Cardápio, Vendas Online, História, Mapa, Como Funciona, Anunciante, Avaliação",
            "Acessos por dia da semana — barras mostrando em quais dias da semana o tráfego é maior",
          ]}
        />
        <P>
          <B>Comparação com período anterior</B>
        </P>
        <P>
          Ative o toggle <B>Comparar com período anterior</B> para exibir, ao
          lado de cada KPI, o valor do período equivalente imediatamente
          anterior — útil para identificar tendências de crescimento ou queda.
        </P>
        <P>
          <B>Exportar dados</B>
        </P>
        <P>
          Clique em <B>Exportar CSV</B> para baixar todos os dados do período
          selecionado em formato de planilha, podendo ser aberto no Excel ou
          Google Sheets para análises adicionais.
        </P>
        <Note>
          Os dados são coletados de forma anônima — nenhuma informação pessoal
          do visitante é armazenada. A contagem de visitas usa sessionStorage
          para evitar duplicatas dentro da mesma sessão de navegador.
        </Note>
      </div>
    ),
  },
  {
    id: "repositorios",
    category: "dev",
    title: "Repositórios",
    summary:
      "Links para os repositórios GitHub dos três sistemas do Cine Drive-In.",
    bodyText: "repositório github código fonte site admin web versão",
    content: (
      <div className="flex flex-col gap-4">
        <P>Os três sistemas estão hospedados no GitHub:</P>
        <div className="flex flex-col gap-2">
          {[
            {
              label: "Site público",
              repo: "cine-drivein-site",
              url: "https://github.com/leoFagundes/cine-drivein-site",
              desc: "Site estático voltado ao público: programação de filmes, mapa e informações do cinema.",
            },
            {
              label: "Painel Admin",
              repo: "cinedrivein-admin-v2",
              url: "https://github.com/leoFagundes/cinedrivein-admin-v2",
              desc: "Painel de gerenciamento interno: pedidos, estoque, usuários, configurações e logs.",
            },
            {
              label: "App Web do cliente v2",
              repo: "cine-drivein-web-v2",
              url: "https://github.com/leoFagundes/cine-drivein-web-v2",
              desc: "Aplicação web usada pelos clientes para fazer pedidos durante as sessões.",
            },
          ].map(({ label, repo, url, desc }) => (
            <a
              key={repo}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1 p-3 rounded-[var(--radius-md)] transition-colors"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "rgba(234,179,8,0.5)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-border)")
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold"
                  style={{ color: "rgb(234,179,8)" }}
                >
                  {label}
                </span>
                <span
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: "rgba(234,179,8,0.1)",
                    color: "rgb(234,179,8)",
                    border: "1px solid rgba(234,179,8,0.25)",
                  }}
                >
                  {repo}
                </span>
              </div>
              <span
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {desc}
              </span>
              <span
                className="text-[11px] font-mono mt-0.5"
                style={{ color: "var(--color-text-muted)", opacity: 0.6 }}
              >
                {url}
              </span>
            </a>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "tecnologias",
    category: "dev",
    title: "Tecnologias utilizadas",
    summary: "Stack técnica dos três sistemas do Cine Drive-In.",
    bodyText:
      "tecnologias stack next react typescript tailwind firebase firestore rtdb framer motion recharts jspdf mapbox google maps qz tray serial",
    content: (
      <div className="flex flex-col gap-4">
        {[
          {
            label: "Site público",
            color: "#0088c2",
            techs: [
              {
                name: "Next.js 14",
                desc: "Framework React com export estático",
              },
              { name: "React 18 + TypeScript", desc: "UI e tipagem estática" },
              { name: "Tailwind CSS 3", desc: "Estilização utilitária" },
              {
                name: "Firebase Firestore + RTDB",
                desc: "Banco de dados e tempo real",
              },
              { name: "Framer Motion", desc: "Animações de interface" },
              { name: "Mapbox GL + Google Maps", desc: "Mapas interativos" },
              { name: "React Icons", desc: "Biblioteca de ícones SVG" },
              { name: "react-snowfall", desc: "Efeito sazonal de neve" },
            ],
          },
          {
            label: "Painel Admin",
            color: "#a855f7",
            techs: [
              {
                name: "Next.js 16",
                desc: "Framework React com export estático",
              },
              { name: "React 19 + TypeScript", desc: "UI e tipagem estática" },
              { name: "Tailwind CSS 4", desc: "Estilização utilitária" },
              {
                name: "Firebase Firestore + RTDB + Auth + Storage",
                desc: "Banco de dados, autenticação e arquivos",
              },
              { name: "Recharts", desc: "Gráficos para a aba de estatísticas" },
              {
                name: "jsPDF + AutoTable",
                desc: "Exportação de relatórios em PDF",
              },
              { name: "QZ Tray", desc: "Comunicação com impressoras térmicas" },
              {
                name: "Web Serial API",
                desc: "Interface serial nativa do navegador",
              },
              { name: "React Icons", desc: "Biblioteca de ícones SVG" },
            ],
          },
          {
            label: "App Web do cliente",
            color: "#22c55e",
            techs: [
              {
                name: "Next.js 16",
                desc: "Framework React com export estático",
              },
              { name: "React 19 + TypeScript", desc: "UI e tipagem estática" },
              { name: "Tailwind CSS 4", desc: "Estilização utilitária" },
              {
                name: "Firebase Firestore + RTDB",
                desc: "Banco de dados e sincronização em tempo real",
              },
              {
                name: "Firebase Cloud Functions",
                desc: "Lógica de backend serverless",
              },
              { name: "React Icons", desc: "Biblioteca de ícones SVG" },
            ],
          },
        ].map(({ label, color, techs }) => (
          <div key={label}>
            <p className="text-xs font-semibold mb-2" style={{ color }}>
              {label}
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {techs.map(({ name, desc }) => (
                <div
                  key={name}
                  className="flex flex-col px-3 py-2 rounded-[var(--radius-md)]"
                  style={{
                    backgroundColor: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {name}
                  </span>
                  <span
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "dev-mode",
    category: "dev",
    ownerOnly: true,
    title: "Dev Mode",
    summary:
      "Ferramentas de desenvolvimento e testes para o Owner. Ative com Ctrl+Shift+D.",
    bodyText:
      "dev mode desenvolvimento testes flags logs console toasts permissões firestore ids confirmações perfil simular bypass",
    content: (
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Conjunto de ferramentas para desenvolvimento e testes. As flags
          persistem no <span className="font-mono text-xs">localStorage</span>{" "}
          do navegador e não afetam outros usuários. Visível apenas para o
          Owner.
        </p>
        <button
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "D",
                ctrlKey: true,
                shiftKey: true,
                bubbles: true,
              }),
            )
          }
          className="self-start flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md cursor-pointer transition-all"
          style={{
            backgroundColor: "rgba(234,179,8,0.1)",
            border: "1px solid rgba(234,179,8,0.35)",
            color: "rgb(234,179,8)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "rgba(234,179,8,0.18)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "rgba(234,179,8,0.1)")
          }
        >
          <FiZap size={11} />
          Abrir painel Dev Mode
        </button>
        <div className="grid gap-2 sm:grid-cols-2">
          {DEV_FLAGS.map(({ icon, label, description }) => (
            <div
              key={label}
              className="flex items-start gap-2.5 p-3 rounded-[var(--radius-md)]"
              style={{
                backgroundColor: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span
                className="mt-0.5 shrink-0"
                style={{ color: "rgb(234,179,8)" }}
              >
                {icon}
              </span>
              <div className="min-w-0">
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {label}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

// ── Helper components ──────────────────────────────────────────────────────────

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-sm leading-relaxed"
      style={{ color: "var(--color-text-secondary)" }}
    >
      {children}
    </p>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return (
    <strong style={{ color: "var(--color-text-primary)" }}>{children}</strong>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 pl-1">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-start gap-2 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <span
            className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: "var(--color-primary)" }}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-[var(--radius-md)]"
      style={{
        backgroundColor: "rgba(0,136,194,0.07)",
        border: "1px solid rgba(0,136,194,0.2)",
      }}
    >
      <span
        className="text-xs mt-0.5 flex-shrink-0"
        style={{ color: "var(--color-primary)" }}
      >
        ℹ
      </span>
      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {children}
      </p>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-[var(--radius-md)]"
      style={{
        backgroundColor: "rgba(245,158,11,0.07)",
        border: "1px solid rgba(245,158,11,0.2)",
      }}
    >
      <span
        className="text-xs mt-0.5 flex-shrink-0"
        style={{ color: "var(--color-warning)" }}
      >
        ⚠
      </span>
      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {children}
      </p>
    </div>
  );
}

// ── Search highlight ──────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            style={{
              backgroundColor: "rgba(0,136,194,0.22)",
              color: "inherit",
              borderRadius: "2px",
              padding: "0 2px",
            }}
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORIES: {
  key: Category;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    key: "todos",
    label: "Todos",
    icon: <FiHelpCircle size={14} />,
    color: "var(--color-text-muted)",
  },
  {
    key: "pedidos",
    label: "Pedidos",
    icon: <FiShoppingBag size={14} />,
    color: "#0088c2",
  },
  {
    key: "dashboard",
    label: "Dashboard",
    icon: <FiGrid size={14} />,
    color: "#a855f7",
  },
  {
    key: "impressora",
    label: "Impressora",
    icon: <FiPrinter size={14} />,
    color: "#14b8a6",
  },
  {
    key: "chat",
    label: "Chat",
    icon: <FiMessageSquare size={14} />,
    color: "#22c55e",
  },
  {
    key: "estoque",
    label: "Estoque",
    icon: <FiBox size={14} />,
    color: "#f97316",
  },
  {
    key: "sistema",
    label: "Sistema",
    icon: <FiSettings size={14} />,
    color: "#f59e0b",
  },
  {
    key: "dev",
    label: "Dev",
    icon: <FiZap size={14} />,
    color: "rgb(234,179,8)",
  },
];

// ── Article card ───────────────────────────────────────────────────────────────

function ArticleCard({ article, query }: { article: Article; query: string }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORIES.find((c) => c.key === article.category)!;

  const q = query.trim().toLowerCase();
  const inTitle = !!(q && article.title.toLowerCase().includes(q));
  const inSummary = !!(q && article.summary.toLowerCase().includes(q));
  const inBody = !!(
    q &&
    article.bodyText?.toLowerCase().includes(q) &&
    !inTitle &&
    !inSummary
  );

  // Body-match cards stay open while the query is active; user-opened cards
  // stay open independently. Clicking a body-match card has no visible effect
  // while searching (it can't be closed) — acceptable trade-off without extra state.
  const isOpen = open || inBody;

  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: `1px solid ${inTitle || inSummary || inBody ? "rgba(0,136,194,0.35)" : "var(--color-border)"}`,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-5 py-4 text-left cursor-pointer transition-colors"
        style={{
          backgroundColor: isOpen ? "var(--color-bg-elevated)" : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!isOpen)
            e.currentTarget.style.backgroundColor = "var(--color-bg-elevated)";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
            >
              {cat.icon}
              {cat.label}
            </span>
            {inBody && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "rgba(0,136,194,0.1)",
                  color: "var(--color-primary)",
                  border: "1px solid rgba(0,136,194,0.2)",
                }}
              >
                resultado no conteúdo
              </span>
            )}
          </div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            <Highlight text={article.title} query={query} />
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            <Highlight text={article.summary} query={query} />
          </p>
        </div>
        <FiChevronDown
          size={16}
          style={{
            color: "var(--color-text-muted)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
            marginTop: 2,
          }}
        />
      </button>

      {isOpen && (
        <div
          className="px-5 py-4 flex flex-col gap-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {article.content}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const { appUser } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("todos");

  const isOwner = appUser?.isOwner ?? false;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ARTICLES.filter((a) => {
      if (a.ownerOnly && !isOwner) return false;
      if (activeCategory !== "todos" && a.category !== activeCategory)
        return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.bodyText?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [search, activeCategory, isOwner]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 w-full max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FiHelpCircle size={20} style={{ color: "var(--color-primary)" }} />
          <h1
            className="text-xl sm:text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Central de Ajuda
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Encontre explicações sobre todas as funcionalidades do sistema.
        </p>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)]"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <FiSearch
          size={16}
          style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por palavra-chave..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--color-text-primary)" }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ color: "var(--color-text-muted)" }}
          >
            <FiX size={14} />
          </button>
        )}
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium cursor-pointer transition-all"
              style={{
                backgroundColor: active ? cat.color : "var(--color-bg-surface)",
                color: active ? "white" : "var(--color-text-muted)",
                border: active
                  ? `1px solid ${cat.color}`
                  : "1px solid var(--color-border)",
              }}
            >
              {cat.icon}
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-xs -mt-2" style={{ color: "var(--color-text-muted)" }}>
        {filtered.length}{" "}
        {filtered.length === 1 ? "artigo encontrado" : "artigos encontrados"}
      </p>

      {/* Articles */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 gap-3 rounded-[var(--radius-xl)]"
          style={{
            backgroundColor: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <FiSearch
            size={28}
            style={{ color: "var(--color-text-muted)", opacity: 0.4 }}
          />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Nenhum artigo encontrado para <strong>&quot;{search}&quot;</strong>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} query={search} />
          ))}
        </div>
      )}
    </div>
  );
}
