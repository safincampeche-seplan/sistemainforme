fetch('http://localhost:3007/api/admin/catalogs/narrative-themes', {
  headers: {
    // We don't have token but we can bypass or just see if it fails auth
  }
}).then(r => r.text()).then(console.log).catch(console.error);
