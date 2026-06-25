//! Journal de operaciones estructurales (§2). Registro append-only en JSON-lines
//! que permite detectar operaciones interrumpidas (un `Begin` sin su `Commit`/
//! `Abort`) tras un cierre abrupto, base de la recuperación.

use crate::paths;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OpStatus {
    Begin,
    Commit,
    Abort,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct JournalEntry {
    /// Identificador de la operación (enlaza Begin con Commit/Abort).
    pub seq: u128,
    /// Nombre de la operación ("save", "migrate", "snapshot", ...).
    pub op: String,
    pub status: OpStatus,
    pub unix_nanos: u128,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

fn now_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0)
}

pub struct Journal {
    path: PathBuf,
}

impl Journal {
    pub fn open(project_root: &Path) -> Self {
        Self {
            path: paths::journal_path(project_root),
        }
    }

    fn append(&self, entry: &JournalEntry) -> io::Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut line = serde_json::to_string(entry)
            .map_err(io::Error::other)?;
        line.push('\n');
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        f.write_all(line.as_bytes())?;
        f.sync_all()
    }

    /// Marca el inicio de una operación y devuelve su `seq`.
    pub fn begin(&self, op: &str) -> io::Result<u128> {
        let seq = now_nanos();
        self.append(&JournalEntry {
            seq,
            op: op.to_string(),
            status: OpStatus::Begin,
            unix_nanos: seq,
            detail: None,
        })?;
        Ok(seq)
    }

    pub fn commit(&self, seq: u128, op: &str) -> io::Result<()> {
        self.append(&JournalEntry {
            seq,
            op: op.to_string(),
            status: OpStatus::Commit,
            unix_nanos: now_nanos(),
            detail: None,
        })
    }

    pub fn abort(&self, seq: u128, op: &str, reason: &str) -> io::Result<()> {
        self.append(&JournalEntry {
            seq,
            op: op.to_string(),
            status: OpStatus::Abort,
            unix_nanos: now_nanos(),
            detail: Some(reason.to_string()),
        })
    }

    pub fn entries(&self) -> Vec<JournalEntry> {
        let Ok(content) = fs::read_to_string(&self.path) else {
            return Vec::new();
        };
        content
            .lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str::<JournalEntry>(l).ok())
            .collect()
    }

    /// Operaciones con `Begin` pero sin `Commit`/`Abort` posterior: interrumpidas.
    pub fn incomplete(&self) -> Vec<JournalEntry> {
        let entries = self.entries();
        let mut resolved = std::collections::BTreeSet::new();
        for e in &entries {
            if matches!(e.status, OpStatus::Commit | OpStatus::Abort) {
                resolved.insert(e.seq);
            }
        }
        entries
            .into_iter()
            .filter(|e| e.status == OpStatus::Begin && !resolved.contains(&e.seq))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn begin_commit_has_no_incomplete() {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path());
        let seq = j.begin("save").unwrap();
        j.commit(seq, "save").unwrap();
        assert!(j.incomplete().is_empty());
        assert_eq!(j.entries().len(), 2);
    }

    #[test]
    fn begin_without_commit_is_incomplete() {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path());
        let _seq = j.begin("migrate").unwrap();
        let inc = j.incomplete();
        assert_eq!(inc.len(), 1);
        assert_eq!(inc[0].op, "migrate");
    }

    #[test]
    fn abort_resolves_operation() {
        let dir = tempfile::tempdir().unwrap();
        let j = Journal::open(dir.path());
        let seq = j.begin("save").unwrap();
        j.abort(seq, "save", "fallo de disco").unwrap();
        assert!(j.incomplete().is_empty());
    }
}
