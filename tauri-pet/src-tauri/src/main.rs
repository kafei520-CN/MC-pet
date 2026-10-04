#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod desktop;

use desktop::capture_desktop;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, PhysicalPosition, PhysicalSize};

#[derive(Clone, serde::Deserialize)]
struct HitRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

struct PointerState {
    rects: Vec<HitRect>,
    held: bool,
    cursor_x: f64,
    cursor_y: f64,
}

static POINTER: std::sync::LazyLock<std::sync::Mutex<PointerState>> =
    std::sync::LazyLock::new(|| {
        std::sync::Mutex::new(PointerState {
            rects: Vec::new(),
            held: false,
            cursor_x: 0.0,
            cursor_y: 0.0,
        })
    });

#[tauri::command]
fn desktop_map() -> desktop::DesktopMap {
    capture_desktop()
}

#[tauri::command]
fn seat_rect(id: String) -> Option<desktop::WindowSeat> {
    desktop::seat_rect(&id)
}

fn pet_settings_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    Ok(dir.join("pet-settings.json"))
}

fn world_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    Ok(dir.join("world").join("save.json"))
}

fn legacy_world_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    Ok(dir.join("world.json"))
}

#[tauri::command]
fn load_pet_settings(app: tauri::AppHandle) -> Option<String> {
    let path = pet_settings_path(&app).ok()?;
    std::fs::read_to_string(path).ok()
}

#[tauri::command]
fn save_pet_settings(app: tauri::AppHandle, settings: String) -> Result<(), String> {
    let path = pet_settings_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    std::fs::write(path, settings).map_err(|err| err.to_string())
}

#[tauri::command]
fn load_world(app: tauri::AppHandle) -> Option<String> {
    let path = world_path(&app).ok()?;
    if let Ok(text) = std::fs::read_to_string(&path) {
        return Some(text);
    }
    let legacy = legacy_world_path(&app).ok()?;
    std::fs::read_to_string(legacy).ok()
}

#[tauri::command]
fn save_world(app: tauri::AppHandle, world: String) -> Result<(), String> {
    let path = world_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    std::fs::write(path, world).map_err(|err| err.to_string())
}

#[derive(serde::Serialize)]
struct CursorPoint {
    x: f64,
    y: f64,
}

#[tauri::command]
fn set_pointer_targets(rects: Vec<HitRect>, held: bool) -> CursorPoint {
    let mut state = POINTER.lock().expect("pointer state");
    state.rects = rects;
    state.held = held;
    CursorPoint {
        x: state.cursor_x,
        y: state.cursor_y,
    }
}

fn start_pointer_thread(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut through = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(16));
            let Some(window) = app.get_webview_window("main") else {
                continue;
            };
            let inside = cursor_hits_target(&window);
            let next_through = !inside;
            if next_through != through {
                let _ = window.set_ignore_cursor_events(next_through);
                through = next_through;
            }
        }
    });
}

fn cursor_hits_target(window: &tauri::WebviewWindow) -> bool {
    let cursor = cursor_in_overlay(window);
    let mut state = POINTER.lock().expect("pointer state");
    if let Some((x, y)) = cursor {
        state.cursor_x = x;
        state.cursor_y = y;
    }
    if state.held {
        return true;
    }
    let Some((x, y)) = cursor else {
        return false;
    };
    state.rects.iter().any(|rect| {
        x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height
    })
}

fn cursor_in_overlay(window: &tauri::WebviewWindow) -> Option<(f64, f64)> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::HiDpi::GetDpiForSystem;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
    let mut point = POINT::default();
    if unsafe { GetCursorPos(&mut point) }.is_err() {
        return None;
    }
    let origin = window.outer_position().ok()?;
    let scale = unsafe { GetDpiForSystem() } as f64 / 96.0;
    let scale = if scale > 0.0 { scale } else { 1.0 };
    Some((
        (point.x as f64 - origin.x as f64) / scale,
        (point.y as f64 - origin.y as f64) / scale,
    ))
}

fn work_area() -> Option<windows::Win32::Foundation::RECT> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETWORKAREA};
    let mut area = RECT::default();
    unsafe {
        SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            Some(std::ptr::addr_of_mut!(area).cast()),
            Default::default(),
        )
        .ok()?;
    }
    Some(area)
}

fn hide_from_taskbar(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_APPWINDOW, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW,
    };
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let hwnd = HWND(hwnd.0);
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let style = (style & !(WS_EX_APPWINDOW.0 as isize))
            | (WS_EX_TOOLWINDOW.0 as isize)
            | (WS_EX_NOACTIVATE.0 as isize);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style);
        let _ = SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

fn raise_above_taskbar(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    };
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    unsafe {
        let _ = SetWindowPos(
            HWND(hwnd.0),
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_map,
            seat_rect,
            set_pointer_targets,
            load_pet_settings,
            save_pet_settings,
            load_world,
            save_world
        ])
        .setup(|app| {
            let open_menu = MenuItem::with_id(app, "open-menu", "打开菜单", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_menu, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .tooltip("MC桌宠")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    if event.id() == "open-menu" {
                        if let Some(window) = app.get_webview_window("menu") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    if event.id() == "quit" {
                        app.exit(0);
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            start_pointer_thread(app.handle().clone());

            if let Some(window) = app.get_webview_window("main") {
                if let Some(area) = work_area() {
                    let _ = window.set_position(PhysicalPosition::new(area.left, area.top));
                    let _ = window.set_size(PhysicalSize::new(
                        (area.right - area.left).max(1),
                        (area.bottom - area.top).max(1),
                    ));
                }
                let _ = window.set_ignore_cursor_events(true);
                let _ = window.set_focusable(false);
                let _ = window.set_always_on_top(true);
                hide_from_taskbar(&window);
                raise_above_taskbar(&window);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
