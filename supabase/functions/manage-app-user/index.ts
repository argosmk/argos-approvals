import { handleAppUserRequest } from '../_shared/appUserAdmin.ts';

Deno.serve((req) => handleAppUserRequest(req));
