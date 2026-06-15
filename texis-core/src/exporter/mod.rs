//! Exporter — genera paquetes de entrega (delivery packages).
//!
//! Esta capa es la única implementación real de `export --mode final`.
//! Tanto `texis-cli` como `texis-app/src-tauri` la consumen; nunca duplicar
//! la lógica de generación de ZIP en los dos callers.
//!
//! Punto de entrada principal: [`delivery::create_delivery_package`].

pub mod delivery;
pub mod platform;

pub use delivery::{create_delivery_package, DeliveryInput, DeliveryOptions, DeliveryResult};
pub use platform::{export_for_platform, ExportTarget, PlatformExportInput, PlatformExportResult};
