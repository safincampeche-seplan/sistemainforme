#!/bin/bash

# =========================================================================
# SCRIPT DE RESPALDO AUTOMÁTICO - SISTEMA DE CAPTURA DE INFORMES V2
# =========================================================================
# Este script está diseñado para ejecutarse diariamente vía cronjob.
# Exporta la estructura completa, datos, rutinas y triggers de la BD.

# Configuración
DB_USER="root"
# Por seguridad, es recomendable usar un archivo de configuración para la contraseña o variables de entorno
DB_PASS="PON_AQUÍ_TU_CONTRASEÑA_MYSQL"
DB_NAME="seplan_captura"
BACKUP_DIR="/var/backups/seplan"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="seplan_backup_${TIMESTAMP}.sql"
LOG_FILE="/var/log/seplan_backup.log"

# Asegurar que el directorio existe
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando respaldo de la base de datos '$DB_NAME'..." | tee -a "$LOG_FILE"

# Ejecutar mysqldump
mysqldump -u "$DB_USER" -p"$DB_PASS" \
    --routines --triggers --events \
    --single-transaction --quick \
    "$DB_NAME" > "${BACKUP_DIR}/${FILENAME}"

# Verificar si el comando fue exitoso
if [ $? -eq 0 ]; then
    echo "[$(date)] Respaldo SQL completado exitosamente: ${FILENAME}" | tee -a "$LOG_FILE"
    
    # Comprimir el archivo para ahorrar espacio (opcional pero recomendado)
    gzip "${BACKUP_DIR}/${FILENAME}"
    echo "[$(date)] Compresión exitosa: ${FILENAME}.gz" | tee -a "$LOG_FILE"

    # Eliminar respaldos más antiguos a 30 días para no saturar el disco
    find "$BACKUP_DIR" -type f -name "seplan_backup_*.sql.gz" -mtime +30 -exec rm {} \;
    echo "[$(date)] Limpieza de respaldos antiguos cruzada." | tee -a "$LOG_FILE"
    echo "==========================================" | tee -a "$LOG_FILE"
else
    echo "[$(date)] ERROR CRÍTICO: Falló la exportación mysqldump." | tee -a "$LOG_FILE"
    echo "==========================================" | tee -a "$LOG_FILE"
fi

# Instrucciones de Uso:
# 1. Hacer ejecutable este script: chmod +x scripts/backup_db.sh
# 2. Abrir editor cron del servidor: crontab -e
# 3. Pegar la siguiente línea al final para ejecutar todos los días a las 3:00 AM:
# 0 3 * * * /ruta/absoluta/a/capturainforme/scripts/backup_db.sh >> /var/log/cron_seplan.log 2>&1
