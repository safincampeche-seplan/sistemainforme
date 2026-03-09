const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/Sidebar.tsx');

let content = fs.readFileSync(file, 'utf8');
content = content.replace(/roles:\s*\[([^\]]+)\]/g, (match, roles) => {
    let newRoles = roles;
    if (roles.includes('"SuperAdministrador"')) {
        newRoles = newRoles.replace(/"SuperAdministrador"/g, '"SuperAdministrador", "super_admin"');
    }
    if (roles.includes('"Administrador"')) {
        newRoles = newRoles.replace(/"Administrador"/g, '"Administrador", "admin"');
    }
    if (roles.includes('"Capturista"')) {
        newRoles = newRoles.replace(/"Capturista"/g, '"Capturista", "capturista"');
    }
    if (roles.includes('"Validador"')) {
        newRoles = newRoles.replace(/"Validador"/g, '"Validador", "validador"');
    }
    if (roles.includes('"SECONT"')) {
        newRoles = newRoles.replace(/"SECONT"/g, '"SECONT", "secont"');
    }
    return `roles: [${newRoles}]`;
});

// Also fix the isSuperAdmin check
content = content.replace(/user\?.roles\?.includes\('SuperAdministrador'\)/g, "(user?.roles?.includes('SuperAdministrador') || user?.roles?.includes('super_admin'))");

// Also fix fetchObservationsCount
content = content.replace(/user\?.roles\?.includes\('Capturista'\)/g, "(user?.roles?.includes('Capturista') || user?.roles?.includes('capturista'))");

fs.writeFileSync(file, content, 'utf8');
console.log("Sidebar fixed.");
