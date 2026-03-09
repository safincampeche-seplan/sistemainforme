const fs = require('fs');
const path = require('path');
const directoryPath = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(directoryPath);
let modifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix permissions.ts or any role checking utilities
    if (file.includes('permissions.ts') || file.includes('AuthContext')) {
        content = content.replace(/['"]SuperAdministrador['"]/g, "'super_admin'");
        content = content.replace(/['"]Administrador['"]/g, "'admin'");
        content = content.replace(/['"]Capturista['"]/g, "'capturista'");
        content = content.replace(/['"]Validador['"]/g, "'validador'");
        content = content.replace(/['"]SECONT['"]/g, "'secont'");
    } else {
        // Fix hasPermission('SuperAdministrador') or includes('SuperAdministrador')
        content = content.replace(/includes\(['"]SuperAdministrador['"]\)/g, "includes('super_admin')");
        content = content.replace(/includes\(['"]Administrador['"]\)/g, "includes('admin')");
        content = content.replace(/includes\(['"]Capturista['"]\)/g, "includes('capturista')");
        content = content.replace(/includes\(['"]Validador['"]\)/g, "includes('validador')");
        content = content.replace(/includes\(['"]SECONT['"]\)/g, "includes('secont')");
        
        // Fix role arrays like allowedRoles = ['SuperAdministrador']
        content = content.replace(/['"]SuperAdministrador['"]/g, "'super_admin'");
        // Be careful not to replace text that is just displayed to the user
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        modifiedCount++;
    }
});

console.log(`Arreglados ${modifiedCount} archivos de permisos.`);
