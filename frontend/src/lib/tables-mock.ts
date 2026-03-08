export interface StatisticalTable {
    id: string;
    name: string;
    department: string;
    status: 'Aprobado' | 'En Revisión' | 'Borrador';
    lastUpdate: string;
}

export const mockTables: StatisticalTable[] = [
    { id: "EST-0124", name: "Índice de Escolaridad 2026", department: "SEDUC", status: "Aprobado", lastUpdate: "2026-02-15" },
    { id: "EST-0125", name: "Capacidad Hospitalaria", department: "SALUD", status: "En Revisión", lastUpdate: "2026-02-20" },
    { id: "EST-0126", name: "Turismo Interno Trimestral", department: "SECTUR", status: "Borrador", lastUpdate: "2026-02-28" },
    { id: "EST-0127", name: "Producción Agrícola por Municipio", department: "SDA", status: "En Revisión", lastUpdate: "2026-02-25" },
];
