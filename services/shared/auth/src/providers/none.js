/**
 * Mode `none` : aucune vérification, pour le développement et les tests uniquement.
 * En-têtes facultatifs :
 *   X-Dev-User  : identifiant du membre (défaut « dev-membre »)
 *   X-Dev-Roles : rôles séparés par des virgules (défaut « membre,moderateur »)
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
