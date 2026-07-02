// Compatibilidade para builds antigos/cache do front que ainda chamam create-app-user.
// A função oficial é manage-app-user, mas esta rota evita quebrar criação enquanto o deploy propaga.
import { handleAppUserRequest } from '../_shared/appUserAdmin.ts';

Deno.serve((req) => handleAppUserRequest(req, 'create'));
