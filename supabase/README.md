# Supabase - Argos Approval

## Ordem correta

1. Rode `01_schema.sql` no SQL Editor do Supabase.
2. Vá em Authentication > Users > Add user.
3. Crie o usuário inicial:
   - email interno: `andre.admin@argos.local`
   - senha: a senha combinada com o André
4. Copie o UID do usuário criado.
5. Abra `02_after_creating_auth_user.sql`.
6. Substitua `AUTH_USER_UUID` pelo UID.
7. Rode o SQL.
8. Copie `.env.example` para `.env.local` e preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
9. Rode `npm install` e `npm run dev`.

## Observação importante

Esta rodada cria a fundação real online. O app atual ainda mantém fallback local para não travar o desenvolvimento. A próxima rodada conecta cada tela definitivamente nas tabelas.
