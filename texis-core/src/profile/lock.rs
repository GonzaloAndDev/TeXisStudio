// profile.lock.yaml — congela el perfil activo de un proyecto.
//
// Ninguna actualización de TeXisStudio cambia silenciosamente el significado
// académico de una tesis ya creada (D8).
//
// Nivel P1 — sin diff ni migración guiada. Solo detecta presencia/ausencia
// y ofrece crear el lock con el perfil activo.

use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::{CoreError, CoreResult};

/// Contenido del archivo `profile.lock.yaml` en la raíz del proyecto.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileLock {
    /// ID del perfil congelado.
    pub profile_id: String,
    /// Versión del perfil en el momento del congelado.
    pub profile_version: String,
    /// Estado del perfil en el momento del congelado ("draft", "reviewed", "verified", etc.).
    pub profile_status_at_lock: String,
    /// Fuente del perfil: "TeXisStudio-Profiles" | "local" | URL remota.
    pub source: String,
    /// SHA-256 del profile.yaml congelado.
    pub sha256: String,
    /// Timestamp ISO 8601 del congelado.
    pub locked_at: String,
    /// Versión del texis-core usada al congelar.
    pub texis_core_version: String,
}

impl ProfileLock {
    /// Ruta canónica del lock dentro de un proyecto.
    pub fn path_in_project(project_dir: &Path) -> std::path::PathBuf {
        project_dir.join("profile.lock.yaml")
    }

    /// Carga el lock desde el disco. Devuelve `None` si el archivo no existe.
    pub fn load(project_dir: &Path) -> CoreResult<Option<Self>> {
        let path = Self::path_in_project(project_dir);
        if !path.exists() {
            return Ok(None);
        }
        let content = std::fs::read_to_string(&path).map_err(CoreError::Io)?;
        let lock: Self = serde_yaml::from_str(&content).map_err(|e| CoreError::YamlParse {
            path: path.to_string_lossy().to_string(),
            message: e.to_string(),
        })?;
        Ok(Some(lock))
    }

    /// Persiste el lock en el disco.
    pub fn save(&self, project_dir: &Path) -> CoreResult<()> {
        let path = Self::path_in_project(project_dir);
        let yaml = serde_yaml::to_string(self).map_err(|e| CoreError::YamlParse {
            path: path.to_string_lossy().to_string(),
            message: e.to_string(),
        })?;
        std::fs::write(&path, yaml).map_err(CoreError::Io)?;
        Ok(())
    }

    /// Calcula el SHA-256 de un archivo y lo devuelve como hex string.
    pub fn sha256_of_file(path: &Path) -> CoreResult<String> {
        use std::io::Read;
        let mut file = std::fs::File::open(path).map_err(CoreError::Io)?;
        let mut hasher = Sha256State::new();
        let mut buf = [0u8; 8192];
        loop {
            let n = file.read(&mut buf).map_err(CoreError::Io)?;
            if n == 0 { break; }
            hasher.update(&buf[..n]);
        }
        Ok(hasher.finalize())
    }
}

/// Estado del lock para la UI.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LockStatus {
    /// El proyecto tiene profile.lock.yaml.
    Locked,
    /// El proyecto no tiene profile.lock.yaml — perfil sin congelar.
    Unlocked,
}

/// Comprueba si un proyecto tiene el perfil congelado.
pub fn check_lock_status(project_dir: &Path) -> LockStatus {
    if ProfileLock::path_in_project(project_dir).exists() {
        LockStatus::Locked
    } else {
        LockStatus::Unlocked
    }
}

// ── SHA-256 minimal (sin dependencia externa) ────────────────────────────────
// Implementación RFC 6234 / FIPS 180-4 para no añadir una crate de crypto
// solo para calcular checksums de archivos YAML pequeños.

struct Sha256State {
    h: [u32; 8],
    len: u64,
    buf: Vec<u8>,
}

impl Sha256State {
    fn new() -> Self {
        Self {
            h: [
                0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
            ],
            len: 0,
            buf: Vec::new(),
        }
    }

    fn update(&mut self, data: &[u8]) {
        self.len += data.len() as u64;
        self.buf.extend_from_slice(data);
        while self.buf.len() >= 64 {
            let block: [u8; 64] = self.buf[..64].try_into().unwrap();
            self.buf.drain(..64);
            self.process_block(&block);
        }
    }

    fn finalize(mut self) -> String {
        let bit_len = self.len * 8;
        self.buf.push(0x80);
        while (self.buf.len() % 64) != 56 {
            self.buf.push(0);
        }
        self.buf.extend_from_slice(&bit_len.to_be_bytes());
        while self.buf.len() >= 64 {
            let block: [u8; 64] = self.buf[..64].try_into().unwrap();
            self.buf.drain(..64);
            self.process_block(&block);
        }
        let mut out = String::with_capacity(64);
        for word in self.h {
            out.push_str(&format!("{word:08x}"));
        }
        out
    }

    fn process_block(&mut self, block: &[u8; 64]) {
        const K: [u32; 64] = [
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,
            0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
            0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,
            0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,
            0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
            0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,
            0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,
            0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
            0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
        ];

        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes(block[i*4..i*4+4].try_into().unwrap());
        }
        for i in 16..64 {
            let s0 = w[i-15].rotate_right(7) ^ w[i-15].rotate_right(18) ^ (w[i-15] >> 3);
            let s1 = w[i-2].rotate_right(17) ^ w[i-2].rotate_right(19) ^ (w[i-2] >> 10);
            w[i] = w[i-16].wrapping_add(s0).wrapping_add(w[i-7]).wrapping_add(s1);
        }

        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = self.h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = h.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            h = g; g = f; f = e;
            e = d.wrapping_add(temp1);
            d = c; c = b; b = a;
            a = temp1.wrapping_add(temp2);
        }
        self.h[0] = self.h[0].wrapping_add(a);
        self.h[1] = self.h[1].wrapping_add(b);
        self.h[2] = self.h[2].wrapping_add(c);
        self.h[3] = self.h[3].wrapping_add(d);
        self.h[4] = self.h[4].wrapping_add(e);
        self.h[5] = self.h[5].wrapping_add(f);
        self.h[6] = self.h[6].wrapping_add(g);
        self.h[7] = self.h[7].wrapping_add(h);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_empty() {
        let mut s = Sha256State::new();
        s.update(b"");
        let result = s.finalize();
        assert_eq!(
            result,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn sha256_abc() {
        let mut s = Sha256State::new();
        s.update(b"abc");
        let result = s.finalize();
        assert_eq!(
            result,
            "ba7816bf8f01cfea414140de5dae2ec73b00361bbef0469632f0f0b0c2e49d45"
        );
    }

    #[test]
    fn lock_status_unlocked_cuando_no_hay_archivo() {
        let tmp = tempfile::TempDir::new().unwrap();
        assert_eq!(check_lock_status(tmp.path()), LockStatus::Unlocked);
    }
}
