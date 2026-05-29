pub mod credential_store;

/// Política de seguridad de la aplicación.
/// Estas constantes son la fuente de verdad para las decisiones de seguridad.
pub mod policy {
    /// shell-escape NUNCA activo por defecto. Requiere confirmación explícita del usuario.
    pub const SHELL_ESCAPE_DEFAULT: bool = false;

    /// Descargas remotas requieren HTTPS. HTTP siempre rechazado.
    pub const REQUIRE_HTTPS: bool = true;

    /// Hosts permitidos para descargas de packs de idioma.
    pub const ALLOWED_ASSET_HOSTS: &[&str] = &[
        "raw.githubusercontent.com",
        "cdn.jsdelivr.net",
    ];

    /// Sin telemetría por defecto. El usuario debe optar activamente.
    pub const TELEMETRY_DEFAULT: bool = false;

    /// Tamaño máximo de archivo para descargas de diccionarios (5 MB).
    pub const MAX_DICT_BYTES: usize = 5 * 1024 * 1024;

    /// Tamaño máximo para UI locales (500 KB).
    pub const MAX_UI_LOCALE_BYTES: usize = 500 * 1024;

    /// Tamaño máximo de ZIP para perfiles remotos (10 MB).
    pub const MAX_REMOTE_PROFILE_ZIP_BYTES: usize = 10 * 1024 * 1024;

    /// Número máximo de entradas en un ZIP de perfil (prevenir zip bombs).
    pub const MAX_ZIP_ENTRIES: usize = 200;

    /// Tamaño máximo total descomprimido de un ZIP de perfil (50 MB).
    pub const MAX_UNCOMPRESSED_ZIP_BYTES: u64 = 50 * 1024 * 1024;

    /// User-Agent para peticiones HTTP a APIs externas.
    pub const HTTP_USER_AGENT: &str = concat!(
        "TeXisStudio/",
        env!("CARGO_PKG_VERSION"),
        " (https://github.com/GonzaloAndDev/TeXisStudio; mailto:gaelsd25@gmail.com)"
    );
}

/// Valida que una URL es segura para descargar.
/// Retorna Ok(()) si es válida, Err con el motivo si no.
pub fn validate_download_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url)
        .map_err(|e| format!("URL inválida '{}': {}", url, e))?;

    if parsed.scheme() != "https" {
        return Err(format!(
            "Solo se permiten descargas por HTTPS. URL rechazada: '{}'",
            url
        ));
    }

    let host = parsed.host_str().ok_or_else(|| format!("URL sin host: '{}'", url))?;

    if !policy::ALLOWED_ASSET_HOSTS.contains(&host) {
        return Err(format!(
            "Host '{}' no está en la lista de hosts permitidos ({}).",
            host,
            policy::ALLOWED_ASSET_HOSTS.join(", ")
        ));
    }

    if parsed.path().contains("..") {
        return Err(format!("Path traversal detectado en URL: '{}'", url));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_github_raw_url_passes() {
        assert!(validate_download_url(
            "https://raw.githubusercontent.com/GonzaloAndDev/TeXisStudio-Languages/main/catalog.json"
        ).is_ok());
    }

    #[test]
    fn http_url_rejected() {
        assert!(validate_download_url(
            "http://raw.githubusercontent.com/file.json"
        ).is_err());
    }

    #[test]
    fn unknown_host_rejected() {
        assert!(validate_download_url(
            "https://malicious.example.com/payload.json"
        ).is_err());
    }

    #[test]
    fn path_traversal_rejected() {
        assert!(validate_download_url(
            "https://raw.githubusercontent.com/../../../etc/passwd"
        ).is_err());
    }

    #[test]
    fn shell_escape_default_is_false() {
        assert!(!policy::SHELL_ESCAPE_DEFAULT);
    }

    #[test]
    fn telemetry_default_is_false() {
        assert!(!policy::TELEMETRY_DEFAULT);
    }
}
