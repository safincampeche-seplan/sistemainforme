const XLSX = require('xlsx');

const data = [
  { "Municipio": "Campeche", "Hombres": 120, "Mujeres": 150, "Total": 270, "Observaciones": "Campaña en el centro" },
  { "Municipio": "Carmen", "Hombres": 85, "Mujeres": 110, "Total": 195, "Observaciones": "Campaña en escuelas" },
  { "Municipio": "Champotón", "Hombres": 45, "Mujeres": 55, "Total": 100, "Observaciones": "Brigadas móviles" },
  { "Municipio": "Escárcega", "Hombres": 30, "Mujeres": 40, "Total": 70, "Observaciones": "Centro de salud" },
  { "Municipio": "Calkiní", "Hombres": 25, "Mujeres": 35, "Total": 60, "Observaciones": "Plaza principal" }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Pláticas Impartidas");

XLSX.writeFile(wb, "Datos_Platicas_Salud_Prueba.xlsx");
console.log("Archivo 'Datos_Platicas_Salud_Prueba.xlsx' generado exitosamente.");
