import { Permission } from "@/types";

export const PERMISSION_META: Record<Permission, { label: string; description: string }> = {
  approve_users:   { label: "Aprovar usuários",    description: "Aprovar ou rejeitar cadastros pendentes" },
  manage_users:    { label: "Gerenciar usuários",  description: "Editar perfil e remover usuários" },
  manage_profiles: { label: "Gerenciar perfis",    description: "Criar e editar perfis de permissão" },
  manage_orders:   { label: "Gerenciar pedidos",   description: "Visualizar e atualizar pedidos" },
  manage_stock:    { label: "Gerenciar estoque",   description: "Adicionar e editar itens do cardápio" },
  manage_schedule: { label: "Gerenciar horários",  description: "Configurar horários de abertura" },
  manage_site:     { label: "Gerenciar site",      description: "Editar filmes, eventos e configurações" },
  view_reports:    { label: "Ver relatórios",      description: "Acessar relatórios e gráficos" },
  view_logs:       { label: "Ver logs",            description: "Visualizar o histórico de ações do sistema" },
};

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: "Usuários",
    permissions: ["approve_users", "manage_users", "manage_profiles"],
  },
  {
    label: "Operação",
    permissions: ["manage_orders", "manage_stock", "manage_schedule"],
  },
  {
    label: "Site",
    permissions: ["manage_site"],
  },
  {
    label: "Relatórios & Logs",
    permissions: ["view_reports", "view_logs"],
  },
];
