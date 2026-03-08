export const MODULE_PERMISSIONS = {
    CAPTURA: ['SuperAdministrador', 'Administrador', 'Capturista'],
    REVISION: ['SuperAdministrador', 'Administrador', 'Validador', 'SAFIN', 'SECONT', 'Capturista'],
    EXPORTACION: ['SuperAdministrador', 'Administrador'],
    ADMIN: ['SuperAdministrador'],
    REVISION_ANEXO: ['SuperAdministrador', 'Administrador', 'Validador', 'SAFIN', 'SECONT', 'Capturista'],
    GESTION_MATRICES: ['SuperAdministrador', 'Administrador', 'SAFIN', 'SECONT'],
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
