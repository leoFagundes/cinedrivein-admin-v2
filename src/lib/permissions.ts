import { Permission } from "@/types";

export const PERMISSION_META: Record<Permission, { label: string; description: string }> = {
  // Dashboard
  view_dashboard:       { label: "Visualizar Dashboard",             description: "Acessar o painel de controle" },
  manage_store:         { label: "Abrir e Fechar lanchonete",        description: "Controlar o status da lanchonete" },
  generate_report:      { label: "Gerar relatório",                  description: "Fechar expediente e gerar relatório diário" },
  delete_chart_data:    { label: "Excluir dados dos gráficos",       description: "Limpar dados históricos dos gráficos" },
  // Pedidos
  view_orders:          { label: "Visualizar Pedidos",               description: "Acessar a lista de pedidos" },
  delete_orders:        { label: "Deletar pedidos",                  description: "Excluir pedidos finalizados e cancelados" },
  cancel_orders:        { label: "Cancelar pedidos",                 description: "Cancelar pedidos ativos" },
  finish_orders:        { label: "Finalizar pedidos",                description: "Finalizar pedidos e registrar pagamento" },
  edit_orders:          { label: "Editar pedidos",                   description: "Editar itens e dados de pedidos ativos" },
  chat_orders:          { label: "Acesso ao chat",                   description: "Enviar e receber mensagens no chat do pedido" },
  create_order:         { label: "Criar novo pedido",                description: "Abrir o formulário para criar um pedido manualmente" },
  manage_chat_templates: { label: "Gerenciar mensagens prontas",     description: "Criar, editar e excluir modelos de mensagens" },
  // Estoque
  view_stock:           { label: "Visualizar estoque",               description: "Acessar a página de estoque" },
  create_item:          { label: "Criar novo item",                  description: "Adicionar novos itens ao cardápio" },
  create_subitem:       { label: "Criar novo subitem",               description: "Adicionar subitens (adicionais) aos itens" },
  edit_item:            { label: "Editar item",                      description: "Modificar itens existentes do cardápio" },
  edit_subitem:         { label: "Editar subitem",                   description: "Modificar subitens existentes" },
  delete_item:          { label: "Deletar item",                     description: "Remover itens do cardápio" },
  delete_subitem:       { label: "Deletar subitem",                  description: "Remover subitems do cardápio" },
  manage_category_order: { label: "Gerenciar ordenação das categorias", description: "Reordenar as categorias do cardápio" },
  // Usuarios
  view_users:           { label: "Visualizar Usuários",              description: "Acessar a lista de usuários" },
  edit_users:           { label: "Editar usuários",                  description: "Alterar dados de usuários" },
  approve_users:        { label: "Aprovar usuários",                 description: "Aprovar ou rejeitar cadastros pendentes" },
  delete_users:         { label: "Deletar usuários",                 description: "Remover usuários do sistema" },
  manage_profiles:      { label: "Gerenciar perfis de acesso",       description: "Criar, editar e atribuir perfis de permissão" },
  create_user:          { label: "Criar um novo usuário",            description: "Cadastrar novos usuários no sistema" },
  // Logs
  view_logs:            { label: "Visualizar LOGS",                  description: "Acessar o histórico de ações do sistema" },
  delete_logs:          { label: "Excluir logs",                     description: "Remover registros de auditoria" },
  // Site
  view_site:            { label: "Visualizar configurações do site", description: "Acessar a página de configurações do site" },
  manage_movies:        { label: "Gerenciar filmes",                 description: "Editar a programação de filmes" },
  manage_site_settings: { label: "Gerenciar configurações extras",   description: "Editar evento, popup e outras configurações" },
};

export interface PermissionGroup {
  label: string;
  viewPerm: Permission;
  permissions: Permission[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Dashboard",
    viewPerm: "view_dashboard",
    permissions: ["view_dashboard", "manage_store", "generate_report", "delete_chart_data"],
  },
  {
    label: "Pedidos",
    viewPerm: "view_orders",
    permissions: ["view_orders", "delete_orders", "cancel_orders", "finish_orders", "edit_orders", "chat_orders", "create_order", "manage_chat_templates"],
  },
  {
    label: "Estoque",
    viewPerm: "view_stock",
    permissions: ["view_stock", "create_item", "create_subitem", "edit_item", "edit_subitem", "delete_item", "delete_subitem", "manage_category_order"],
  },
  {
    label: "Usuarios",
    viewPerm: "view_users",
    permissions: ["view_users", "edit_users", "approve_users", "delete_users", "manage_profiles", "create_user"],
  },
  {
    label: "Logs",
    viewPerm: "view_logs",
    permissions: ["view_logs", "delete_logs"],
  },
  {
    label: "Configuracoes do Site",
    viewPerm: "view_site",
    permissions: ["view_site", "manage_movies", "manage_site_settings"],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.permissions);
