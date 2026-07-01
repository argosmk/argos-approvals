# Argos Approval - Round 22 Cloud Bridge

Esta versão conecta o sistema ao Supabase Auth + `workspace_state`.
É uma ponte segura para começar a usar online sem perder dados enquanto migramos tela por tela para tabelas relacionais.

## Rodar local

1. Copie `.env.example` para `.env`
2. Preencha:

```env
VITE_SUPABASE_URL=https://wzgdpfjsyxlxiapbuknp.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_PUBLIC_KEY
```

3. Rode:

```bash
npm install
npm run dev
```

## Supabase

Você já rodou:

- `supabase/01_schema.sql`
- `supabase/02_after_creating_auth_user.sql`

Agora rode também:

- `supabase/03_workspace_state_permissions.sql`

## Login

Use o e-mail criado no Supabase Auth, por exemplo:

```txt
andre@argosmk.com
```

A senha é a senha definida no Supabase Auth.

## Observação

Nesta fase os dados do sistema ficam salvos no Supabase em `workspace_state`.
Na próxima fase, podemos migrar cada módulo para suas tabelas próprias: tasks, task_events, companies, profiles etc.
