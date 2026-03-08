import pandas as pd

data = {
    "Municipio": ["Campeche", "Carmen", "Champotón", "Escárcega", "Calkiní"],
    "Hombres": [120, 85, 45, 30, 25],
    "Mujeres": [150, 110, 55, 40, 35],
    "Total": [270, 195, 100, 70, 60],
    "Observaciones": ["Centro", "Escuelas", "Móviles", "Hospital", "Plaza"]
}

df = pd.DataFrame(data)
df.to_excel("Datos_Platicas_Salud_Prueba.xlsx", index=False)
print("Archivo generado exitosamente.")
