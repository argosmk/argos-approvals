# Round87 - Correção de usuários

## O que foi corrigido

- O front-end agora chama apenas `manage-app-user` para criar usuários.
- A Edge Function `manage-app-user` foi refeita para pegar o usuário logado pelo header `Authorization`, sem depender de sessão interna da Edge Function.
- `organization_id` agora vem do perfil admin logado quando o payload não mandar organização.
- A criação agora também repara o caso em que o e-mail ainda existe em `auth.users`, mas o perfil público foi apagado.
- Foi adicionada uma `create-app-user` de compatibilidade para builds/cache antigos que ainda chamarem a função velha.

## Arquivos principais

- `src/main.jsx`
- `dist/`
- `supabase/functions/manage-app-user/index.ts`
- `supabase/functions/create-app-user/index.ts`
- `supabase/functions/_shared/appUserAdmin.ts`

## Deploy das Edge Functions

No terminal, dentro do projeto:

```bash
supabase functions deploy manage-app-user
supabase functions deploy create-app-user
```

A `create-app-user` fica só como airbag de compatibilidade. A função oficial é `manage-app-user`.

## Depois do deploy

1. Publicar o novo `dist` no Pages.
2. Fazer logout/login no sistema.
3. Testar criar usuário novo.
4. Testar criar novamente um e-mail que ficou preso no Auth, como o caso do Heli.

Nos logs deve aparecer:

```txt
manage-app-user round87 action=create
```
