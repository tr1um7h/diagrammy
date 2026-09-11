use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// A markdown/diagram source file discovered in the project folder.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SourceFile {
    pub name: String,
    pub path: String,
}

pub struct AppState {
    pub watched_directory: Mutex<Option<PathBuf>>,
}

const SUPPORTED_EXTENSIONS: [&str; 3] = ["md", "mmd", "puml"];
const SKIPPED_DIRS: [&str; 6] = ["node_modules", "target", "dist", ".git", ".svn", ".hg"];

fn is_supported(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

#[tauri::command]
async fn select_directory(app: AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = mpsc::channel();

    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Recursively scan a folder for .md / .mmd / .puml files.
#[tauri::command]
async fn scan_source_files(directory: String) -> Result<Vec<SourceFile>, String> {
    let path = Path::new(&directory);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", directory));
    }

    let mut files = Vec::new();
    collect_source_files(path, &mut files, 0)?;
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(files)
}

fn collect_source_files(
    dir: &Path,
    files: &mut Vec<SourceFile>,
    depth: usize,
) -> Result<(), String> {
    if depth > 16 {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(|e| format!("{}: {}", dir.display(), e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if path.is_dir() {
            if name.starts_with('.') || SKIPPED_DIRS.contains(&name.as_ref()) {
                continue;
            }
            collect_source_files(&path, files, depth + 1)?;
        } else if path.is_file() && is_supported(&path) {
            files.push(SourceFile {
                name: name.to_string(),
                path: path.to_string_lossy().to_string(),
            });
        }
    }
    Ok(())
}

#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    if !path.is_file() {
        return Err(format!("Not a file: {}", file_path));
    }
    fs::read_to_string(path).map_err(|e| format!("{}: {}", file_path, e))
}

#[tauri::command]
async fn write_file(file_path: String, content: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if !path.is_file() {
        return Err(format!("Refusing to write to non-existing file: {}", file_path));
    }
    fs::write(path, content).map_err(|e| format!("{}: {}", file_path, e))
}

/// Watch a folder recursively and emit `fs-change` events with the changed paths.
#[tauri::command]
async fn watch_directory(
    app: AppHandle,
    directory: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let path = PathBuf::from(&directory);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", directory));
    }

    {
        let mut watched = state.watched_directory.lock().unwrap();
        *watched = Some(path.clone());
    }

    let app_handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();

    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    watcher
        .watch(&path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    // Leak the watcher so it lives for the whole app lifetime (recommended_watcher
    // stops watching when dropped).
    std::mem::forget(watcher);

    std::thread::spawn(move || loop {
        match rx.recv() {
            Ok(Ok(Event {
                kind: EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_),
                paths,
                ..
            })) => {
                let changed: Vec<String> = paths
                    .iter()
                    .filter(|p| is_supported(p))
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                if !changed.is_empty() {
                    let _ = app_handle.emit("fs-change", &changed);
                }
            }
            Ok(Err(e)) => eprintln!("Watch error: {:?}", e),
            Err(e) => {
                eprintln!("Watch channel closed: {:?}", e);
                break;
            }
            _ => {}
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            watched_directory: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            select_directory,
            scan_source_files,
            read_file,
            write_file,
            watch_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
