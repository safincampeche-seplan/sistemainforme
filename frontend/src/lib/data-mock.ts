// Tipos base basados en el esquema de la base de datos
export type Status =
    | 'draft'
    | 'under_validation'
    | 'with_observations'
    | 'approved_semaig'
    | 'approved_secont'
    | 'sent_to_supervisor'
    | 'finished';

export interface DashboardMetrics {
    totalPPAs: number;
    approvedSEMAIG: number;
    totalTables: number;
    beneficiariesCount: string;
    ppaGrowth: string;
    tableGrowth: string;
    advancePercentage: number;
}

export interface ActivityItem {
    id: string;
    name: string;
    department: string;
    status: string;
    date: string;
    type: 'ppa' | 'table';
}

export const mockMetrics: DashboardMetrics = {
    totalPPAs: 1245,
    approvedSEMAIG: 854,
    totalTables: 432,
    beneficiariesCount: "125.4K",
    ppaGrowth: "+12% mensual",
    tableGrowth: "+34 nuevas",
    advancePercentage: 68.5
};

export const mockActivity: ActivityItem[] = [
    { id: '1', name: "Apoyo a la Educación Rural", department: "Educación", status: "Aprobado SECONT", date: "Hace 2 horas", type: 'ppa' },
    { id: '2', name: "Modernización de Caminos", department: "Infraestructura", status: "En Validación SEMAIG", date: "Hace 5 horas", type: 'ppa' },
    { id: '3', name: "Salud para Todos", department: "Salud", status: "Con Observaciones", date: "Ayer", type: 'ppa' },
    { id: '4', name: "Índice de Escolaridad", department: "SEDUC", status: "Aprobado", date: "Ayer", type: 'table' },
];
