// Tests de integración para perfiles institucionales revisados.
// Verifican que los perfiles cumplen los requisitos mínimos definidos
// por sus guías institucionales oficiales.

use std::path::PathBuf;
use texis_core::profile::{ProfileLoader, ProfileStatus};

fn profiles_repo() -> PathBuf {
    // El repo de perfiles vive junto al workspace TeXisStudio.
    // En CI se puede sobreescribir con la variable TEXIS_PROFILES_PATH.
    if let Ok(p) = std::env::var("TEXIS_PROFILES_PATH") {
        return PathBuf::from(p);
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest
        .parent()           // texis-core → raíz del workspace
        .expect("workspace root")
        .parent()           // TeXisStudio → directorio padre
        .expect("parent of TeXisStudio")
        .join("TeXisStudio-Profiles")
}

fn load_profile(rel_path: &str) -> texis_core::profile::Profile {
    let path = profiles_repo().join(rel_path);
    assert!(
        path.exists(),
        "perfil no encontrado en: {}",
        path.display()
    );
    let loader = ProfileLoader;
    loader
        .load_from_file(&path)
        .unwrap_or_else(|e| panic!("fallo al cargar {rel_path}: {e}"))
}

/// Convierte "40mm" → 40.0, "2.54cm" → 25.4, "1in" → 25.4
fn parse_length_mm(s: &str) -> Option<f64> {
    let s = s.trim();
    if let Some(n) = s.strip_suffix("mm") {
        n.trim().parse::<f64>().ok()
    } else if let Some(n) = s.strip_suffix("cm") {
        n.trim().parse::<f64>().ok().map(|v| v * 10.0)
    } else if let Some(n) = s.strip_suffix("in") {
        n.trim().parse::<f64>().ok().map(|v| v * 25.4)
    } else {
        s.parse::<f64>().ok()
    }
}

// ── Cambridge APA 7 ───────────────────────────────────────────────

#[test]
fn cambridge_apa7_carga_sin_errores() {
    load_profile("europe/uk/cambridge/apa7/profile.yaml");
}

#[test]
fn cambridge_apa7_status_reviewed() {
    let p = load_profile("europe/uk/cambridge/apa7/profile.yaml");
    assert_eq!(
        p.status,
        ProfileStatus::Reviewed,
        "Cambridge APA7 debe tener status reviewed"
    );
}

#[test]
fn cambridge_apa7_tiene_verification_con_source_urls() {
    let p = load_profile("europe/uk/cambridge/apa7/profile.yaml");
    let v = p.verification.expect("Cambridge APA7 debe tener bloque verification");
    assert!(
        !v.source_urls.is_empty(),
        "Cambridge APA7 debe tener al menos una source_url"
    );
    assert!(
        v.source_urls.iter().any(|u| u.contains("cam.ac.uk")),
        "source_urls debe incluir una URL de cam.ac.uk"
    );
}

#[test]
fn cambridge_apa7_margen_izquierdo_encuadernacion() {
    // Cambridge Graduate Office: margen izquierdo mínimo 40mm.
    let p = load_profile("europe/uk/cambridge/apa7/profile.yaml");
    let layout = p.page_layout.expect("debe tener page_layout");
    let margins = layout.margins.expect("debe tener margins");
    let left_mm = margins
        .left
        .as_deref()
        .and_then(parse_length_mm)
        .expect("margen izquierdo debe ser una longitud válida (ej. '40mm')");
    assert!(
        left_mm >= 40.0,
        "margen izquierdo debe ser >= 40mm (Cambridge binding), es {left_mm:.1}mm"
    );
}

#[test]
fn cambridge_apa7_interlineado_doble() {
    let p = load_profile("europe/uk/cambridge/apa7/profile.yaml");
    let layout = p.page_layout.expect("debe tener page_layout");
    let spacing = layout.line_spacing.expect("debe tener line_spacing") as f64;
    assert!(
        spacing >= 1.5,
        "interlineado debe ser >= 1.5 (Cambridge exige doble), es {spacing}"
    );
}

#[test]
fn cambridge_apa7_tiene_seccion_abstract() {
    let p = load_profile("europe/uk/cambridge/apa7/profile.yaml");
    let has_abstract = p
        .sections
        .iter()
        .any(|s| s.element_id == "abstract_en" || s.element_id == "abstract");
    assert!(has_abstract, "debe tener sección abstract");
}

#[test]
fn cambridge_apa7_tiene_portada_y_referencias_required() {
    let p = load_profile("europe/uk/cambridge/apa7/profile.yaml");
    let has_cover = p
        .sections
        .iter()
        .any(|s| s.element_id == "title_page" && s.required);
    let has_refs = p
        .sections
        .iter()
        .any(|s| s.element_id == "references" && s.required);
    assert!(has_cover, "title_page debe ser required");
    assert!(has_refs, "references debe ser required");
}

// ── Oxford MHRA ───────────────────────────────────────────────────

#[test]
fn oxford_mhra_carga_sin_errores() {
    load_profile("europe/uk/oxford/mhra/profile.yaml");
}

#[test]
fn oxford_mhra_status_reviewed() {
    let p = load_profile("europe/uk/oxford/mhra/profile.yaml");
    assert_eq!(
        p.status,
        ProfileStatus::Reviewed,
        "Oxford MHRA debe tener status reviewed"
    );
}

#[test]
fn oxford_mhra_tiene_verification_con_source_urls() {
    let p = load_profile("europe/uk/oxford/mhra/profile.yaml");
    let v = p.verification.expect("Oxford MHRA debe tener bloque verification");
    assert!(
        !v.source_urls.is_empty(),
        "Oxford MHRA debe tener al menos una source_url"
    );
    assert!(
        v.source_urls.iter().any(|u| u.contains("ox.ac.uk")),
        "source_urls debe incluir una URL de ox.ac.uk"
    );
}

#[test]
fn oxford_mhra_margen_izquierdo_encuadernacion() {
    let p = load_profile("europe/uk/oxford/mhra/profile.yaml");
    let layout = p.page_layout.expect("debe tener page_layout");
    let margins = layout.margins.expect("debe tener margins");
    let left_mm = margins
        .left
        .as_deref()
        .and_then(parse_length_mm)
        .expect("margen izquierdo debe ser una longitud válida");
    assert!(
        left_mm >= 40.0,
        "margen izquierdo debe ser >= 40mm (Oxford binding), es {left_mm:.1}mm"
    );
}

#[test]
fn oxford_mhra_interlineado_doble() {
    let p = load_profile("europe/uk/oxford/mhra/profile.yaml");
    let layout = p.page_layout.expect("debe tener page_layout");
    let spacing = layout.line_spacing.expect("debe tener line_spacing") as f64;
    assert!(
        spacing >= 1.5,
        "interlineado debe ser >= 1.5 (Oxford requiere doble), es {spacing}"
    );
}

#[test]
fn oxford_mhra_tiene_secciones_minimas() {
    let p = load_profile("europe/uk/oxford/mhra/profile.yaml");
    let has_cover = p.sections.iter().any(|s| s.element_id == "title_page");
    let has_abstract = p
        .sections
        .iter()
        .any(|s| s.element_id == "abstract_en" || s.element_id == "abstract");
    let has_bib = p.sections.iter().any(|s| s.element_id == "references");
    assert!(has_cover, "debe tener title_page");
    assert!(has_abstract, "debe tener abstract");
    assert!(has_bib, "debe tener references/bibliography");
}

// ── Límites de palabras ───────────────────────────────────────────

#[test]
fn cambridge_apa7_max_words_80k() {
    let p = load_profile("europe/uk/cambridge/apa7/profile.yaml");
    let limit = p.max_words.expect("Cambridge APA7 debe declarar max_words");
    assert_eq!(limit, 80_000, "Cambridge: límite debe ser 80 000 palabras");
    let abs = p.max_abstract_words.expect("Cambridge APA7 debe declarar max_abstract_words");
    assert_eq!(abs, 300, "Cambridge: resumen debe limitarse a 300 palabras");
}

#[test]
fn oxford_mhra_max_words_100k() {
    let p = load_profile("europe/uk/oxford/mhra/profile.yaml");
    let limit = p.max_words.expect("Oxford MHRA debe declarar max_words");
    assert_eq!(limit, 100_000, "Oxford DPhil: límite debe ser 100 000 palabras");
    let abs = p.max_abstract_words.expect("Oxford MHRA debe declarar max_abstract_words");
    assert_eq!(abs, 300, "Oxford: resumen debe limitarse a 300 palabras");
}

// ── Perfiles internos bundled ─────────────────────────────────────

fn internal_profiles_dir() -> PathBuf {
    if let Ok(p) = std::env::var("TEXIS_INTERNAL_PROFILES_PATH") {
        return PathBuf::from(p);
    }
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest
        .parent()
        .expect("workspace root")
        .join("profiles")
}

fn load_internal(id: &str) -> texis_core::profile::Profile {
    let path = internal_profiles_dir().join(id).join("profile.yaml");
    assert!(
        path.exists(),
        "perfil interno no encontrado: {}",
        path.display()
    );
    ProfileLoader
        .load_from_file(&path)
        .unwrap_or_else(|e| panic!("fallo al cargar perfil interno '{id}': {e}"))
}

const INTERNAL_PROFILE_IDS: &[&str] = &[
    "generic.phd",
    "generic.thesis",
    "generic.tesina",
    "apa.basic",
    "engineering.basic",
    "vancouver.health",
    "company.internship",
];

#[test]
fn perfiles_internos_cargan_sin_errores() {
    let dir = internal_profiles_dir();
    if !dir.exists() {
        return;
    }
    for id in INTERNAL_PROFILE_IDS {
        load_internal(id);
    }
}

#[test]
fn perfiles_internos_son_reviewed() {
    let dir = internal_profiles_dir();
    if !dir.exists() {
        return;
    }
    for id in INTERNAL_PROFILE_IDS {
        let p = load_internal(id);
        assert_eq!(
            p.status,
            ProfileStatus::Reviewed,
            "perfil interno '{id}' debe tener status reviewed"
        );
    }
}

#[test]
fn perfiles_internos_tienen_verification_con_source_urls() {
    let dir = internal_profiles_dir();
    if !dir.exists() {
        return;
    }
    for id in INTERNAL_PROFILE_IDS {
        let p = load_internal(id);
        let v = p
            .verification
            .unwrap_or_else(|| panic!("perfil interno '{id}' debe tener bloque verification"));
        assert!(
            !v.source_urls.is_empty(),
            "perfil interno '{id}' debe tener al menos una source_url"
        );
        assert!(
            v.verified_at.is_some(),
            "perfil interno '{id}' debe tener verified_at"
        );
    }
}

#[test]
fn perfiles_internos_schema_version_actual() {
    let dir = internal_profiles_dir();
    if !dir.exists() {
        return;
    }
    for id in INTERNAL_PROFILE_IDS {
        let p = load_internal(id);
        assert_eq!(
            p.schema_version, "1.0.0",
            "perfil interno '{id}' debe usar schema_version 1.0.0"
        );
    }
}

#[test]
fn perfiles_internos_tienen_secciones_minimas() {
    let dir = internal_profiles_dir();
    if !dir.exists() {
        return;
    }
    for id in INTERNAL_PROFILE_IDS {
        let p = load_internal(id);
        let has_cover = p
            .sections
            .iter()
            .any(|s| s.element_id == "title_page" && s.required);
        let has_refs = p.sections.iter().any(|s| s.element_id == "references");
        assert!(has_cover, "perfil interno '{id}' debe tener title_page required");
        assert!(has_refs, "perfil interno '{id}' debe tener sección references");
    }
}

// ── Invariantes generales para todos los perfiles reviewed ────────

fn all_reviewed_profiles() -> Vec<(String, PathBuf)> {
    let repo = profiles_repo();
    if !repo.exists() {
        return vec![];
    }
    let loader = ProfileLoader;
    let mut result = vec![];
    for entry in walkdir::WalkDir::new(&repo)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name() == "profile.yaml")
    {
        let path = entry.path().to_path_buf();
        if let Ok(p) = loader.load_from_file(&path) {
            if p.status == ProfileStatus::Reviewed || p.status == ProfileStatus::Verified {
                let rel = path
                    .strip_prefix(&repo)
                    .unwrap()
                    .to_string_lossy()
                    .to_string();
                result.push((rel, path));
            }
        }
    }
    result
}

#[test]
fn todos_los_perfiles_reviewed_tienen_verification() {
    for (name, path) in all_reviewed_profiles() {
        let loader = ProfileLoader;
        let p = loader.load_from_file(&path).unwrap();
        assert!(
            p.verification.is_some(),
            "perfil reviewed '{name}' debe tener bloque verification"
        );
        let v = p.verification.unwrap();
        assert!(
            !v.source_urls.is_empty(),
            "perfil reviewed '{name}' debe tener source_urls"
        );
    }
}

#[test]
fn todos_los_perfiles_reviewed_tienen_margen_minimo() {
    for (name, path) in all_reviewed_profiles() {
        let loader = ProfileLoader;
        let p = loader.load_from_file(&path).unwrap();
        if let Some(layout) = p.page_layout {
            if let Some(margins) = layout.margins {
                if let Some(left_str) = margins.left.as_deref() {
                    if let Some(left_mm) = parse_length_mm(left_str) {
                        assert!(
                            left_mm >= 30.0,
                            "perfil reviewed '{name}': margen izquierdo {left_mm:.1}mm es insuficiente (mínimo 30mm)"
                        );
                    }
                }
            }
        }
    }
}
