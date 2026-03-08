from fastapi import FastAPI, Response
from models import ExportRequest, ExcelExportRequest
from doc_generator import generate_word_doc
from pdf_generator import generate_pdf_doc
from excel_generator import generate_styled_excel
import uvicorn

app = FastAPI(title="Doc-Engine V2", description="Servidor de generación de documentos de alto rendimiento")

@app.get("/")
async def root():
    return {"status": "online", "service": "Doc-Engine", "version": "2.0.0"}

@app.post("/export/word")
async def export_word(request: ExportRequest):
    # Generar el documento
    doc_buffer = generate_word_doc(request)
    
    # Preparar el nombre del archivo
    filename = f"Informe_{request.mission_name.replace(' ', '_')}.docx"
    
    return Response(
        content=doc_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
    
@app.post("/export/pdf")
async def export_pdf(request: ExportRequest):
    # Generar el PDF
    pdf_buffer = generate_pdf_doc(request)
    
    filename = f"Informe_{request.mission_name.replace(' ', '_')}.pdf"
    
    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@app.post("/export/excel")
async def export_excel(request: ExcelExportRequest):
    # Generar el Excel
    excel_buffer = generate_styled_excel(request)
    
    filename = f"Excel_{request.entity_name.replace(' ', '_')}.xlsx"
    
    return Response(
        content=excel_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
