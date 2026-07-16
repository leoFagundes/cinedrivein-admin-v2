<h1 align="center">Cine Drive-in — Painel Admin v2</h1>

<p align="center">
  Painel de gerenciamento interno do Cine Drive-in: pedidos em tempo real, estoque, usuários, configurações do site, logs de auditoria e relatórios.
</p>

<p align="center">
  <a href="https://github.com/leoFagundes/cinedrivein-admin-v2">
    <img alt="GitHub repo" src="https://img.shields.io/badge/GitHub-cinedrivein--admin--v2-181717?logo=github">
  </a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss&logoColor=white">
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Firestore%20%2B%20RTDB%20%2B%20Auth%20%2B%20Storage-orange?logo=firebase">
</p>

---

## Sobre o projeto

O Admin v2 é o sistema central de operação do Cine Drive-in. Ele reúne tudo que a equipe precisa durante uma sessão: acompanhamento de pedidos em tempo real, controle de estoque, comunicação via chat com clientes, emissão de relatórios, configuração da programação exibida no site público e auditoria completa de ações via logs.

O acesso é controlado por autenticação Firebase e um sistema de permissões granulares, onde cada usuário recebe um perfil com permissões específicas. O proprietário (`isOwner`) tem acesso irrestrito a todos os recursos.

---

## Funcionalidades

### Dashboard

- Visão geral do dia: total de pedidos, receita, taxa de serviço e descontos
- Gráficos de pedidos por hora, receita por forma de pagamento e itens mais vendidos
- Abertura e fechamento de expediente com geração de estatísticas diárias no Firestore
- Geração de relatório PDF com jsPDF + AutoTable
- Impressão do resumo do dia via impressora térmica
- Histórico de estatísticas anteriores com gráficos comparativos (área, barras, compostos)

### Pedidos

- Lista de pedidos em tempo real via `onSnapshot` do Firestore
- Criação manual de pedidos pela equipe
- Atualização de status: ativo → finalizado / cancelado
- Edição de itens, quantidades, observações, forma de pagamento e descontos
- Chat integrado por pedido — comunicação bidirecional com o app do cliente em tempo real
- Templates de mensagens rápidas configuráveis para respostas no chat
- Impressão de comanda via QZ Tray (impressora térmica) ou Web Serial API (interface serial)
- Cálculo de distância do cliente com base no ponto de estacionamento e geolocalização
- Alertas sonoros configuráveis para novos pedidos e mensagens no chat

### Estoque

- Cadastro completo de itens: código, categoria, preço, preço visível, foto, quantidade e visibilidade
- Subitens (adicionais) com quatro grupos independentes: additionals, sauce, drink, sweet
- Controle automático de estoque: decremento ao finalizar pedidos e alerta de estoque baixo
- Reordenação de categorias por arrastar e soltar
- Upload de imagens para Firebase Storage

### Usuários e Permissões

- Cadastro por fluxo de convite (`/signup`)
- Aprovação manual de novos usuários (status: pending → approved / rejected)
- Perfis de permissão reutilizáveis (ex.: "Atendente", "Gerente", "Caixa")
- 30+ permissões granulares organizadas por módulo
- Avatar gerado automaticamente via DiceBear Avatars
- Tela de bloqueio (lock screen) para ausentar-se sem encerrar a sessão

### Logs e Auditoria

- Registro automático de todas as ações relevantes no Firestore
- Filtros por categoria (auth, users, profiles, orders, stock, site), período e busca textual
- Visualização de mudanças campo a campo (`from → to`)
- Restauração de registros: botão aparece ao passar o mouse em logs elegíveis
  - **Pode restaurar:** exclusão de filmes/itens/subitens, alterações de campos de texto, campos de configuração do site
  - **Não restaura:** imagens removidas do Storage, links de subitens, descrições de pop-up
  - Requer permissão `restore_log`
- Exclusão de logs individuais ou em lote (requer `delete_logs`)

### Configurações do Site

- Gerenciamento das 4 sessões de filmes (pôster, sinopse, elenco, trailer, classificação, avisos, etc.)
- Configuração de preços por dia da semana (meia e inteira)
- Pop-up de avisos: ativar/desativar, imagem, título e descrições
- Modo de evento sazonal: Halloween, Natal, Páscoa
- Feedbacks dos clientes: listagem, marcação de favoritos e visualização de avaliações

### Estatísticas do Site

- Dados coletados anonimamente pelo site público (visitas, cliques por filme, por página, por sessão, dispositivos)
- Períodos: Hoje, 7 dias, 30 dias, 90 dias
- KPIs: visitas totais, cliques em filmes, filmes únicos, sessões únicas, cliques em páginas, distribuição de dispositivos
- Gráficos: visitas diárias (área), dispositivos (pizza), cliques por filme (barras), por sessão (barras), por página (barras), por dia da semana (barras)
- Toggle de comparação entre períodos
- Exportação dos dados brutos em CSV

---

## Sistema de permissões

```
Dashboard:  view_dashboard · manage_store · generate_report · delete_chart_data
Pedidos:    view_orders · delete_orders · cancel_orders · finish_orders
            edit_orders · chat_orders · create_order · manage_chat_templates
Estoque:    view_stock · create_item · create_subitem · edit_item · edit_subitem
            delete_item · delete_subitem · manage_category_order
Usuários:   view_users · edit_users · approve_users · delete_users
            manage_profiles · create_user
Logs:       view_logs · delete_logs · restore_log
Site:       view_site · manage_movies · manage_site_settings
```

Usuários com `isOwner: true` ignoram todas as verificações. O helper `can(user, permission)` suporta Dev Mode (bypass e simulação de perfil).

---

## Estrutura do projeto

```
src/
├── app/
│   ├── login/               → Autenticação com email e senha
│   ├── signup/              → Cadastro por convite (aprovação manual)
│   └── admin/
│       ├── layout.tsx       → Sidebar + AuthGuard (redireciona se não autenticado)
│       ├── dashboard/       → Dashboard, expediente, relatório PDF
│       ├── orders/          → Pedidos em tempo real, chat, impressão
│       ├── stock/           → Estoque, categorias, subitens
│       ├── users/           → Usuários, perfis de permissão
│       ├── logs/            → Logs, restauração de dados
│       ├── site/            → Config. do site, feedbacks, estatísticas
│       ├── profile/         → Perfil do usuário logado, troca de avatar
│       └── help/            → Central de ajuda pesquisável com cards por categoria
├── components/
│   ├── layout/              → Sidebar, AuthGuard, LockScreen, DevModePanel, VersionBanner
│   ├── orders/              → NewOrderModal, OrderChatDrawer, ChatTemplatesModal,
│   │                           ThermalPrinter, SoundAlert
│   └── ui/                  → Button, Input, Toast, DiceBearAvatar, RichTextToolbar
├── contexts/
│   ├── AuthContext          → Usuário logado (AppUser) via Firebase Auth
│   ├── OrdersContext        → Stream de pedidos em tempo real
│   ├── DevModeContext       → Flags de desenvolvimento persistidas em localStorage
│   ├── LockContext          → Tela de bloqueio com PIN
│   └── StockAlertContext    → Alerta global de estoque baixo
├── lib/
│   ├── firebase.ts          → Inicialização: Firestore, RTDB, Auth, Storage
│   ├── logger.ts            → Fire-and-forget: escreve log no Firestore
│   ├── access.ts            → can() / canAny() com suporte a DevMode
│   ├── devMode.ts           → Leitura das flags do DevMode (sem re-render)
│   ├── stock.ts             → decreaseStock / increaseStock
│   ├── pdf-report.ts        → Geração de relatório PDF com jsPDF + AutoTable
│   └── chat-format.tsx      → Parser de formatação rich-text para o chat
└── types/
    └── index.ts             → Todos os tipos: AppUser, Permission, Order, StockItem,
                               Log, Film, SiteConfig, DailyStats, ChatMessage…
```

---

## Tecnologias

| Tecnologia                                                                                                  | Versão | Uso                                                              |
| ----------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| [Next.js](https://nextjs.org/)                                                                              | 16     | Framework com App Router (Server + Client Components)            |
| [React](https://react.dev/)                                                                                 | 19     | Interface com TypeScript                                         |
| [TypeScript](https://www.typescriptlang.org/)                                                               | 5      | Tipagem estática                                                 |
| [Tailwind CSS](https://tailwindcss.com/)                                                                    | 4      | Estilização utilitária                                           |
| [Firebase Firestore](https://firebase.google.com/docs/firestore)                                            | 12     | Banco de dados principal (pedidos, estoque, logs, configurações) |
| [Firebase RTDB](https://firebase.google.com/docs/database)                                                  | 12     | Dados em tempo real (status da loja, presença)                   |
| [Firebase Auth](https://firebase.google.com/docs/auth)                                                      | 12     | Autenticação de usuários com email/senha                         |
| [Firebase Storage](https://firebase.google.com/docs/storage)                                                | 12     | Upload de imagens (itens do estoque, pop-up do site)             |
| [Recharts](https://recharts.org/)                                                                           | 3      | Gráficos do dashboard e estatísticas do site                     |
| [jsPDF](https://github.com/parallax/jsPDF) + [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 4 / 5  | Geração de relatórios PDF                                        |
| [QZ Tray](https://qz.io/)                                                                                   | —      | Impressão térmica via aplicativo desktop instalado na máquina    |
| [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)                           | —      | Alternativa serial para impressoras em Chrome/Edge               |
| [React Icons](https://react-icons.github.io/)                                                               | 5      | Ícones SVG (Feather Icons)                                       |

---

## Configuração do ambiente

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Projeto Firebase configurado (Firestore, RTDB, Auth, Storage)

### Variáveis de ambiente

Crie um arquivo `.env.local` na raiz:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
```

### Instalação e execução

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento
npm run dev

# Build de produção (gera número de versão automaticamente via scripts/update-version.js)
npm run build

# Iniciar em produção
npm start
```

### Impressão térmica (opcional)

Para usar a impressora térmica instale o [QZ Tray](https://qz.io/) no computador que opera o painel. O arquivo `qz-tray.js` deve estar em `/public`. A alternativa via Web Serial API funciona sem software adicional em navegadores compatíveis (Chrome/Edge).

---

## Relação com os outros sistemas

| Sistema                 | Relação                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **cine-drivein-site**   | O admin configura filmes, preços e pop-up que o site consome em tempo real. O site envia dados de analytics que o admin exibe na aba Estatísticas.                                             |
| **cine-drivein-web-v2** | O app dos clientes cria pedidos no Firestore/RTDB que o admin recebe em tempo real. O chat é bidirecional: clientes e atendentes trocam mensagens pelo mesmo documento `orders/{id}/messages`. |

---

## Autor

<p>
  <img src="https://github.com/leoFagundes.png" width="80px" style="border-radius:50%" alt="Leonardo Fagundes" />
  <br/>
  <strong>Leonardo Fagundes</strong>
</p>

[![LinkedIn](https://img.shields.io/badge/-Leonardo%20Fagundes-blue?style=flat-square&logo=Linkedin&logoColor=white)](https://www.linkedin.com/in/leonardo-fagundes-5a348a248/)
[![Gmail](https://img.shields.io/badge/-leofagundes2015@gmail.com-c14438?style=flat-square&logo=Gmail&logoColor=white)](mailto:leofagundes2015@gmail.com)
[![Instagram](https://img.shields.io/badge/-@leo.fagundes.50-E4405F?style=flat-square&logo=instagram&logoColor=white)](https://www.instagram.com/leo.fagundes.50/)
