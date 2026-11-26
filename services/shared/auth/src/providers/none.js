/**
 * `none` mode: no verification, for development and tests only.
 * Optional headers:
 *   X-Dev-User  : member id (default "dev-membre")
 *   X-Dev-Roles : comma-separated roles (default "membre,moderateur")
 */
const DEFAULT_ROLES = ['membre', 'moderateur'];

export function createNoneVerifier() {
  return {
    async verify(req) {
      const rolesHeader = req.get('X-Dev-Roles');
      const roles = rolesHeader
        ? rolesHeader
            .split(',')
            .map((role) => role.trim())
            .filter(Boolean)
        : DEFAULT_ROLES;
      return { id: req.get('X-Dev-User') ?? 'dev-membre', roles, provider: 'none' };
    },
  };
}
