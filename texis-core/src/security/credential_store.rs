//! Almacenamiento seguro de credenciales por plataforma.
//! Las claves de API NUNCA se guardan en texto plano en disco.
//!
//! Backend por plataforma:
//!   macOS   → Keychain Services (Security framework)
//!   Windows → Windows Credential Manager
//!   Linux   → Secret Service API (libsecret / GNOME Keyring / KWallet)
//!
//! Si el backend del SO no está disponible, se usa fallback a variable de entorno
//! y se advierte al usuario.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CredentialError {
    #[error("Backend de credenciales no disponible en este sistema")]
    BackendUnavailable,
    #[error("Credencial no encontrada: servicio='{service}', clave='{key}'")]
    NotFound { service: String, key: String },
    #[error("Error al acceder al almacén de credenciales: {0}")]
    AccessError(String),
    #[error("Credencial inválida (posiblemente corrupta)")]
    InvalidCredential,
}

pub type CredentialResult<T> = Result<T, CredentialError>;

/// Trait abstracto para el almacén de credenciales.
pub trait CredentialStore: Send + Sync {
    /// Guarda una credencial. Sobrescribe si ya existe.
    fn set(&self, service: &str, key: &str, value: &str) -> CredentialResult<()>;
    /// Recupera una credencial. Retorna None si no existe.
    fn get(&self, service: &str, key: &str) -> CredentialResult<Option<String>>;
    /// Elimina una credencial.
    fn delete(&self, service: &str, key: &str) -> CredentialResult<()>;
    /// Verifica si el backend está disponible.
    fn is_available(&self) -> bool;
}

// ── Claves de servicio conocidas ──────────────────────────────────────────────

pub mod service {
    pub const TEXISSTUDIO: &str = "TeXisStudio";
}

pub mod credential_key {
    pub const SEMANTIC_SCHOLAR_API_KEY: &str = "semantic_scholar_api_key";
    pub const ZOTERO_API_KEY: &str = "zotero_api_key";
    pub const ZOTERO_USER_ID: &str = "zotero_user_id";
    pub const CUSTOM_DICT_TOKEN: &str = "custom_dict_token";
}

// ── Implementación para entorno sin Keychain (tests / CI) ─────────────────────

/// Almacén en memoria — solo para tests y entornos sin Keychain.
/// NO usar en producción: los datos no sobreviven entre sesiones.
pub struct InMemoryCredentialStore {
    store: std::sync::Mutex<std::collections::HashMap<String, String>>,
}

impl Default for InMemoryCredentialStore {
    fn default() -> Self {
        Self {
            store: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }
}

impl InMemoryCredentialStore {
    pub fn new() -> Self {
        Self::default()
    }
    fn key(service: &str, key: &str) -> String {
        format!("{}:{}", service, key)
    }
}

impl CredentialStore for InMemoryCredentialStore {
    fn set(&self, service: &str, key: &str, value: &str) -> CredentialResult<()> {
        self.store
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .insert(Self::key(service, key), value.to_string());
        Ok(())
    }

    fn get(&self, service: &str, key: &str) -> CredentialResult<Option<String>> {
        Ok(self
            .store
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .get(&Self::key(service, key))
            .cloned())
    }

    fn delete(&self, service: &str, key: &str) -> CredentialResult<()> {
        self.store
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .remove(&Self::key(service, key));
        Ok(())
    }

    fn is_available(&self) -> bool {
        true
    }
}

// ── Implementación con variable de entorno (fallback) ─────────────────────────

/// Lee credenciales desde variables de entorno.
/// Solo como fallback cuando el Keychain del SO no está disponible.
/// Emite advertencia si se usa en contexto de producción.
pub struct EnvVarCredentialStore;

impl EnvVarCredentialStore {
    fn env_var_name(service: &str, key: &str) -> String {
        format!(
            "{}_{}",
            service.to_uppercase().replace(['-', ' '], "_"),
            key.to_uppercase().replace(['-', ' '], "_")
        )
    }
}

impl CredentialStore for EnvVarCredentialStore {
    fn set(&self, _service: &str, _key: &str, _value: &str) -> CredentialResult<()> {
        // Variables de entorno son de solo lectura desde la app
        Err(CredentialError::AccessError(
            "EnvVarCredentialStore es de solo lectura".to_string(),
        ))
    }

    fn get(&self, service: &str, key: &str) -> CredentialResult<Option<String>> {
        let var = Self::env_var_name(service, key);
        Ok(std::env::var(&var).ok())
    }

    fn delete(&self, _service: &str, _key: &str) -> CredentialResult<()> {
        Err(CredentialError::AccessError(
            "EnvVarCredentialStore no puede eliminar variables de entorno".to_string(),
        ))
    }

    fn is_available(&self) -> bool {
        true
    }
}

// ── Store compuesto: intenta SO, fallback a env var ───────────────────────────

/// En producción, el CredentialManager de Tauri usa el Keychain del SO.
/// Este tipo actúa como proxy y fallback.
pub struct PlatformCredentialStore {
    /// Backend nativo del SO (inyectado por la app Tauri)
    native: Option<Box<dyn CredentialStore>>,
    fallback: EnvVarCredentialStore,
}

impl PlatformCredentialStore {
    pub fn new(native: Option<Box<dyn CredentialStore>>) -> Self {
        Self {
            native,
            fallback: EnvVarCredentialStore,
        }
    }

    pub fn without_native() -> Self {
        Self {
            native: None,
            fallback: EnvVarCredentialStore,
        }
    }
}

impl CredentialStore for PlatformCredentialStore {
    fn set(&self, service: &str, key: &str, value: &str) -> CredentialResult<()> {
        match &self.native {
            Some(n) if n.is_available() => n.set(service, key, value),
            _ => Err(CredentialError::BackendUnavailable),
        }
    }

    fn get(&self, service: &str, key: &str) -> CredentialResult<Option<String>> {
        match &self.native {
            Some(n) if n.is_available() => n.get(service, key),
            _ => self.fallback.get(service, key),
        }
    }

    fn delete(&self, service: &str, key: &str) -> CredentialResult<()> {
        match &self.native {
            Some(n) if n.is_available() => n.delete(service, key),
            _ => Err(CredentialError::BackendUnavailable),
        }
    }

    fn is_available(&self) -> bool {
        self.native
            .as_ref()
            .map(|n| n.is_available())
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn in_memory_store_roundtrip() {
        let store = InMemoryCredentialStore::new();
        store
            .set(
                service::TEXISSTUDIO,
                credential_key::SEMANTIC_SCHOLAR_API_KEY,
                "s2-abc123",
            )
            .unwrap();
        let val = store
            .get(
                service::TEXISSTUDIO,
                credential_key::SEMANTIC_SCHOLAR_API_KEY,
            )
            .unwrap();
        assert_eq!(val, Some("s2-abc123".to_string()));
    }

    #[test]
    fn in_memory_store_delete() {
        let store = InMemoryCredentialStore::new();
        store
            .set(service::TEXISSTUDIO, "test_key", "value")
            .unwrap();
        store.delete(service::TEXISSTUDIO, "test_key").unwrap();
        let val = store.get(service::TEXISSTUDIO, "test_key").unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn in_memory_store_missing_returns_none() {
        let store = InMemoryCredentialStore::new();
        let val = store.get(service::TEXISSTUDIO, "nonexistent").unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn env_var_store_reads_from_environment() {
        // Esto solo funciona si la variable está seteada — en CI puede no estar
        let store = EnvVarCredentialStore;
        let result = store.get("TEST_SERVICE", "test_key");
        // Solo verificamos que no falla, no el valor
        assert!(result.is_ok());
    }

    #[test]
    fn env_var_name_generation() {
        assert_eq!(
            EnvVarCredentialStore::env_var_name("TeXisStudio", "semantic_scholar_api_key"),
            "TEXISSTUDIO_SEMANTIC_SCHOLAR_API_KEY"
        );
    }

    #[test]
    fn platform_store_without_native_uses_fallback() {
        let store = PlatformCredentialStore::without_native();
        assert!(!store.is_available());
        // get() debería caer al fallback de env var
        let result = store.get(service::TEXISSTUDIO, "nonexistent");
        assert!(result.is_ok());
    }
}
