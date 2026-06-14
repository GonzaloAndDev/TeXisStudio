// Convierte errores de core en mensajes comprensibles para el usuario final.
// Los mensajes son en español porque el backend los recibe el frontend vía Tauri
// y se muestran directamente (sin clave i18n) cuando no hay clave más específica.

use texis_core::error::CoreError;

pub fn user_message(e: CoreError) -> String {
    match &e {
        CoreError::Io(io) => friendly_io(io),
        _ => e.to_string(),
    }
}

fn friendly_io(e: &std::io::Error) -> String {
    use std::io::ErrorKind::*;
    match e.kind() {
        PermissionDenied => {
            "Sin permiso de escritura. Verifica los permisos del directorio o elige otra ubicación.".to_string()
        }
        #[allow(unreachable_patterns)]
        StorageFull => {
            "Disco sin espacio suficiente. Libera espacio e intenta de nuevo.".to_string()
        }
        NotFound => "Archivo o directorio no encontrado. Puede haber sido movido o eliminado.".to_string(),
        AlreadyExists => "El archivo ya existe. Usa un nombre diferente.".to_string(),
        TimedOut => "La operación tardó demasiado. Comprueba el sistema de archivos.".to_string(),
        ReadOnlyFilesystem => {
            "El sistema de archivos es de solo lectura. No se puede guardar aquí.".to_string()
        }
        _ => {
            // Detectar ENOSPC por código de OS para sistemas que aún no exponen StorageFull
            if let Some(28) = e.raw_os_error() {
                return "Disco sin espacio suficiente. Libera espacio e intenta de nuevo."
                    .to_string();
            }
            format!("Error al acceder al sistema de archivos: {e}")
        }
    }
}
