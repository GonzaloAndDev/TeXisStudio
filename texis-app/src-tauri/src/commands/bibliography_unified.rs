// Motor bibliográfico unificado — Tauri commands
// Este módulo orquesta el flujo completo:
//   DOI/ISBN/título → proveedores → merger → registry → .bib

use serde::{Deserialize, Serialize};
use texis_core::bibliography::{
    exporters::{BibLaTeXExporter, CslJsonExporter, RisExporter},
    merger::RecordMerger,
    model::{BibliographicRecord, provider},
    normalization::normalize_doi,
};
use std::collections::HashSet;

// ── Tipos de respuesta ────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct RecordImportResult {
    pub record: serde_json::Value,
    pub bibtex: String,
    pub cite_key: String,
    pub was_duplicate: bool,
    pub providers_queried: Vec<String>,
    pub confidence: f32,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub records: Vec<serde_json::Value>,
    pub total_found: usize,
    pub provider: String,
}

#[derive(Deserialize)]
pub struct ImportDoiRequest {
    pub doi: String,
    pub enrich_with_openalex: Option<bool>,
    pub enrich_with_semanticscholar: Option<bool>,
}

// ── Comando principal: importar por DOI con motor unificado ───────────────────

/// Importa una referencia por DOI usando todos los proveedores disponibles,
/// fusiona los resultados y retorna el BibliographicRecord completo + BibTeX.
#[tauri::command]
pub async fn import_doi_unified(
    request: ImportDoiRequest,
) -> Result<RecordImportResult, String> {
    let doi_raw = request.doi.trim();
    if doi_raw.is_empty() {
        return Err("El DOI no puede estar vacío.".to_string());
    }

    let doi_normalized = normalize_doi(doi_raw)
        .ok_or_else(|| format!("DOI inválido: '{}'", doi_raw))?;

    let mut provider_records: Vec<(String, BibliographicRecord)> = Vec::new();
    let mut providers_queried = Vec::new();

    // 1. Crossref (siempre)
    match crate::commands::doi::fetch_record(&doi_normalized).await {
        Ok(record) => {
            providers_queried.push(provider::CROSSREF.to_string());
            provider_records.push((provider::CROSSREF.to_string(), record));
        }
        Err(_) => {
            // Si Crossref falla, intentar DataCite
            match crate::commands::datacite::fetch_record(&doi_normalized).await {
                Ok(record) => {
                    providers_queried.push(provider::DATACITE.to_string());
                    provider_records.push((provider::DATACITE.to_string(), record));
                }
                Err(e) => return Err(format!("DOI no encontrado en Crossref ni DataCite: {e}")),
            }
        }
    }

    // 2. OpenAlex (enriquecimiento — opcional pero recomendado)
    if request.enrich_with_openalex.unwrap_or(true) {
        if let Ok(oa_record) = crate::commands::openalex::fetch_by_doi(&doi_normalized).await {
            providers_queried.push(provider::OPENALEX.to_string());
            provider_records.push((provider::OPENALEX.to_string(), oa_record));
        }
    }

    // 3. Semantic Scholar (opcional)
    if request.enrich_with_semanticscholar.unwrap_or(false) {
        if let Ok(s2_record) = crate::commands::semantic_scholar::fetch_by_doi(
            &doi_normalized,
            None,
        )
        .await
        {
            providers_queried.push(provider::SEMANTIC_SCHOLAR.to_string());
            provider_records.push((provider::SEMANTIC_SCHOLAR.to_string(), s2_record));
        }
    }

    // 4. Fusionar
    let merger = RecordMerger::new();
    let merged = merger.merge(provider_records);
    let confidence = merged.provenance.confidence_score;
    let cite_key = merged.cite_key.clone();

    // 5. Exportar
    let bibtex = BibLaTeXExporter.export(&merged);
    let record_value = serde_json::to_value(&merged)
        .map_err(|e| format!("Error al serializar: {e}"))?;

    Ok(RecordImportResult {
        record: record_value,
        bibtex,
        cite_key,
        was_duplicate: false, // El registry real verificará esto
        providers_queried,
        confidence,
    })
}

/// Importa múltiples DOIs en paralelo (máx 6 concurrentes).
#[tauri::command]
pub async fn import_dois_unified(
    dois: Vec<String>,
) -> Result<Vec<Result<RecordImportResult, String>>, String> {
    use std::collections::HashSet;
    use tokio::sync::Semaphore;
    use std::sync::Arc;

    let semaphore = Arc::new(Semaphore::new(6));
    let unique_dois: Vec<String> = {
        let mut seen = HashSet::new();
        dois.into_iter()
            .filter_map(|d| {
                let n = normalize_doi(d.trim())?;
                if seen.insert(n.clone()) { Some(n) } else { None }
            })
            .collect()
    };

    let handles: Vec<_> = unique_dois
        .into_iter()
        .map(|doi| {
            let sem = semaphore.clone();
            tokio::spawn(async move {
                let _permit = sem.acquire().await;
                import_doi_unified(ImportDoiRequest {
                    doi,
                    enrich_with_openalex: Some(true),
                    enrich_with_semanticscholar: Some(false),
                })
                .await
            })
        })
        .collect();

    let mut results = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(r) => results.push(r),
            Err(e) => results.push(Err(format!("Error interno: {e}"))),
        }
    }
    Ok(results)
}

/// Busca referencias por título en Crossref y OpenAlex y fusiona los resultados.
#[tauri::command]
pub async fn search_bibliography(
    query: String,
    limit: Option<u8>,
) -> Result<SearchResult, String> {
    if query.trim().is_empty() {
        return Err("La consulta no puede estar vacía.".to_string());
    }

    let lim = limit.unwrap_or(10);
    let (crossref_results, openalex_results) = tokio::join!(
        crate::commands::doi::search_by_title(&query, lim),
        crate::commands::openalex::search_by_title(&query, lim),
    );

    // Combinar y deduplicar por DOI
    let mut all: Vec<BibliographicRecord> = Vec::new();
    let mut seen_dois: HashSet<String> = HashSet::new();

    for record in crossref_results.unwrap_or_default() {
        if let Some(doi) = &record.doi {
            if seen_dois.insert(doi.clone()) {
                all.push(record);
            }
        } else {
            all.push(record);
        }
    }
    for record in openalex_results.unwrap_or_default() {
        if let Some(doi) = &record.doi {
            if seen_dois.insert(doi.clone()) {
                all.push(record);
            }
        }
    }

    let total = all.len();
    let records: Vec<serde_json::Value> = all
        .iter()
        .take(lim as usize)
        .filter_map(|r| serde_json::to_value(r).ok())
        .collect();

    Ok(SearchResult {
        records,
        total_found: total,
        provider: "Crossref + OpenAlex".to_string(),
    })
}

/// Exporta un BibliographicRecord (JSON) a BibLaTeX string.
#[tauri::command]
pub fn export_record_to_bibtex(record_json: serde_json::Value) -> Result<String, String> {
    let record: BibliographicRecord = serde_json::from_value(record_json)
        .map_err(|e| format!("Registro inválido: {e}"))?;
    Ok(BibLaTeXExporter.export(&record))
}

/// Exporta un BibliographicRecord a CSL-JSON.
#[tauri::command]
pub fn export_record_to_csl_json(record_json: serde_json::Value) -> Result<serde_json::Value, String> {
    let record: BibliographicRecord = serde_json::from_value(record_json)
        .map_err(|e| format!("Registro inválido: {e}"))?;
    Ok(CslJsonExporter.export(&record))
}

/// Exporta un BibliographicRecord a RIS.
#[tauri::command]
pub fn export_record_to_ris(record_json: serde_json::Value) -> Result<String, String> {
    let record: BibliographicRecord = serde_json::from_value(record_json)
        .map_err(|e| format!("Registro inválido: {e}"))?;
    Ok(RisExporter.export(&record))
}
