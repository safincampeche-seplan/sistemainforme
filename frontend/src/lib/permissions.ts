export const MODULE_PERMISSIONS = {
    CAPTURA: ['super_admin', 'admin', 'capturista'],
    REVISION: ['super_admin', 'admin', 'validador', 'SAFIN', 'secont', 'capturista'],
    EXPORTACION: ['super_admin', 'admin'],
    ADMIN: ['super_admin'],
    REVISION_ANEXO: ['super_admin', 'admin', 'validador', 'SAFIN', 'secont', 'capturista'],
    GESTION_MATRICES: ['super_admin', 'admin', 'SAFIN', 'secont'],
} as const;

export type ModuleName = keyof typeof MODULE_PERMISSIONS;

export function hasPermission(userRoles: string[] | undefined, module: ModuleName): boolean {
    if (!userRoles || !Array.isArray(userRoles)) return false;

    const allowedRoles = MODULE_PERMISSIONS[module];

    // Convertir todo a minúsculas para una comparación robusta
    const userRolesLower = userRoles.map(r => r.toLowerCase());
    const allowedRolesLower = allowedRoles.map(r => r.toLowerCase());

    return userRolesLower.some(role => allowedRolesLower.includes(role));
}
