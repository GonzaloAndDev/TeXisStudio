use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Error de E/S: {0}")]
    Io(#[from] std::io::Error),

    #[error("Error al parsear YAML en '{path}': {message}")]
    YamlParse { path: String, message: String },

    #[error("Error de validación de schema '{schema}' en '{path}': {message}")]
    SchemaValidation {
        schema: String,
        path: String,
        message: String,
    },

    #[error("Perfil no encontrado: '{id}'")]
    ProfileNotFound { id: String },

    #[error("Elemento no encontrado: '{id}'")]
    ElementNotFound { id: String },

    #[error("Error de template '{template}': {message}")]
    Template { template: String, message: String },

    #[error("Error de compilación: {message}")]
    Compilation { message: String },

    #[error("Backend '{backend}' no disponible en este sistema")]
    BackendUnavailable { backend: String },

    #[error("Schema version '{version}' no soportada (actual: {current})")]
    UnsupportedSchemaVersion { version: String, current: String },

    #[error("Proyecto inválido: {message}")]
    InvalidProject { message: String },

    #[error("Archivo no encontrado: '{path}'")]
    FileNotFound { path: String },

    #[error("Error de seguridad en paquete: {message}")]
    SecurityViolation { message: String },
}

pub type CoreResult<T> = Result<T, CoreError>;
