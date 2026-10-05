use serde::Serialize;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use windows::core::{w, BOOL};
use windows::Win32::Foundation::{HWND, LPARAM, RECT, TRUE};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
use windows::Win32::System::Threading::GetCurrentProcessId;
use windows::Win32::UI::HiDpi::GetDpiForSystem;
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowExW, FindWindowW, GetClassNameW, GetSystemMetrics, GetWindowRect,
    GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow, IsWindowVisible, SetWindowPos,
    SystemParametersInfoW, SM_CXSCREEN, SM_CYSCREEN, SPI_GETWORKAREA, SWP_NOACTIVATE, SWP_NOSIZE,
    SWP_NOZORDER,
};

#[derive(Serialize, Clone)]
pub struct ScreenRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Serialize)]
pub struct WindowSeat {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Serialize)]
pub struct DockPushResult {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Serialize)]
pub struct DesktopMap {
    pub width: i32,
    pub height: i32,
    pub obstacles: Vec<ScreenRect>,
    pub windows: Vec<WindowSeat>,
    pub taskbar: Option<ScreenRect>,
    pub tray: Option<ScreenRect>,
}

struct Scan {
    own_pid: u32,
    scale: f32,
    origin_x: i32,
    origin_y: i32,
    screen_w: i32,
    screen_h: i32,
    obstacles: Vec<ScreenRect>,
    windows: Vec<WindowSeat>,
}

pub fn seat_rect(id: &str) -> Option<WindowSeat> {
    let value: isize = id.parse().ok()?;
    let hwnd = HWND(value as *mut core::ffi::c_void);
    unsafe {
        if !IsWindow(Some(hwnd)).as_bool() || !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
            return None;
        }
        let mut raw = RECT::default();
        GetWindowRect(hwnd, &mut raw).ok()?;
        let scale = GetDpiForSystem() as f32 / 96.0;
        let scale = if scale > 0.0 { scale } else { 1.0 };
        let (origin_x, origin_y) = work_origin(scale);
        let rect = to_logical(raw, scale, origin_x, origin_y);
        Some(WindowSeat {
            id: id.to_string(),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        })
    }
}

/// Slide an NxDock window. `dx` and `dy` are logical pixels, same frame as `WindowSeat`.
pub fn push_nexus_dock(id: &str, dx: i32, dy: i32) -> Result<DockPushResult, String> {
    let value: isize = id.parse().map_err(|_| "bad window id".to_string())?;
    let hwnd = HWND(value as *mut core::ffi::c_void);
    unsafe {
        if !IsWindow(Some(hwnd)).as_bool() {
            return Err("missing dock window".to_string());
        }
        if !is_nexus_dock(&window_title(hwnd)) {
            return Err("not a nexus dock".to_string());
        }
        let mut raw = RECT::default();
        GetWindowRect(hwnd, &mut raw).map_err(|err| err.to_string())?;
        let scale = GetDpiForSystem() as f32 / 96.0;
        let scale = if scale > 0.0 { scale } else { 1.0 };
        let left = raw.left + (dx as f32 * scale).round() as i32;
        let top = raw.top + (dy as f32 * scale).round() as i32;
        SetWindowPos(
            hwnd,
            None,
            left,
            top,
            0,
            0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        )
        .map_err(|err| err.to_string())?;
        GetWindowRect(hwnd, &mut raw).map_err(|err| err.to_string())?;
        let (origin_x, origin_y) = work_origin(scale);
        let rect = to_logical(raw, scale, origin_x, origin_y);
        Ok(DockPushResult {
            id: id.to_string(),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        })
    }
}

pub fn capture_desktop() -> DesktopMap {
    let scale = unsafe { GetDpiForSystem() } as f32 / 96.0;
    let scale = if scale > 0.0 { scale } else { 1.0 };
    let (origin_x, origin_y) = work_origin(scale);
    let screen_w = unsafe { (GetSystemMetrics(SM_CXSCREEN) as f32 / scale).round() as i32 };
    let screen_h = unsafe { (GetSystemMetrics(SM_CYSCREEN) as f32 / scale).round() as i32 };
    let mut scan = Scan {
        own_pid: unsafe { GetCurrentProcessId() },
        scale,
        origin_x,
        origin_y,
        screen_w: screen_w.max(1),
        screen_h: screen_h.max(1),
        obstacles: Vec::new(),
        windows: Vec::new(),
    };
    unsafe {
        let pointer = &mut scan as *mut Scan;
        let _ = EnumWindows(Some(enum_window), LPARAM(pointer as isize));
    }
    let taskbar = taskbar_rect(scale);
    let tray = tray_rect(scale);
    let width = scan.screen_w;
    let height = scan.screen_h;
    DesktopMap {
        width: width.max(1),
        height: height.max(1),
        obstacles: scan.obstacles,
        windows: scan.windows,
        taskbar,
        tray,
    }
}

unsafe extern "system" fn enum_window(hwnd: HWND, data: LPARAM) -> BOOL {
    let scan = unsafe { &mut *(data.0 as *mut Scan) };
    // EnumWindows is front-to-back, so the first seat is the front window.
    if let Some((rect, id)) = obstacle_rect(hwnd, scan) {
        scan.windows.push(WindowSeat {
            id,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        });
        scan.obstacles.push(rect);
    }
    TRUE
}

fn obstacle_rect(hwnd: HWND, scan: &Scan) -> Option<(ScreenRect, String)> {
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
            return None;
        }
        let mut owner = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut owner));
        if owner == scan.own_pid {
            return None;
        }
        let class_name = class_name(hwnd);
        if class_name == "Progman"
            || class_name == "WorkerW"
            || class_name == "Shell_TrayWnd"
            || class_name == "Shell_SecondaryTrayWnd"
        {
            return None;
        }
        let mut cloaked = 0u32;
        let _ = DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            &mut cloaked as *mut u32 as *mut _,
            std::mem::size_of::<u32>() as u32,
        );
        if cloaked != 0 && class_name != "Shell_TrayWnd" && class_name != "Shell_SecondaryTrayWnd" {
            return None;
        }
        let mut raw = RECT::default();
        GetWindowRect(hwnd, &mut raw).ok()?;
        let width = raw.right - raw.left;
        let height = raw.bottom - raw.top;
        if width < 160 || height < 80 {
            return None;
        }
        let title = window_title(hwnd);
        if title == "MC桌宠" || title == "菜单" || title == "桌宠" {
            return None;
        }
        if is_nexus_dock(&title) {
            return None;
        }
        Some((
            to_logical(raw, scan.scale, scan.origin_x, scan.origin_y),
            format!("{}", hwnd.0 as isize),
        ))
    }
}

fn is_nexus_dock(title: &str) -> bool {
    title.eq_ignore_ascii_case("NxDock") || title.to_ascii_lowercase().starts_with("nxdock")
}

fn work_origin(scale: f32) -> (i32, i32) {
    let mut area = RECT::default();
    let ok = unsafe {
        SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            Some(std::ptr::addr_of_mut!(area).cast()),
            Default::default(),
        )
    };
    if ok.is_err() {
        return (0, 0);
    }
    (
        (area.left as f32 / scale).round() as i32,
        (area.top as f32 / scale).round() as i32,
    )
}

fn taskbar_rect(scale: f32) -> Option<ScreenRect> {
    unsafe {
        let tray = FindWindowW(w!("Shell_TrayWnd"), None).ok()?;
        let mut raw = RECT::default();
        GetWindowRect(tray, &mut raw).ok()?;
        Some(to_logical(raw, scale, 0, 0))
    }
}

fn tray_rect(scale: f32) -> Option<ScreenRect> {
    unsafe {
        let tray = FindWindowW(w!("Shell_TrayWnd"), None).ok()?;
        let notify = FindWindowExW(Some(tray), Some(HWND::default()), w!("TrayNotifyWnd"), None)
            .unwrap_or(tray);
        let mut raw = RECT::default();
        GetWindowRect(notify, &mut raw).ok()?;
        Some(to_logical(raw, scale, 0, 0))
    }
}

fn to_logical(raw: RECT, scale: f32, origin_x: i32, origin_y: i32) -> ScreenRect {
    let left = (raw.left as f32 / scale).round() as i32 - origin_x;
    let top = (raw.top as f32 / scale).round() as i32 - origin_y;
    let right = (raw.right as f32 / scale).round() as i32 - origin_x;
    let bottom = (raw.bottom as f32 / scale).round() as i32 - origin_y;
    ScreenRect {
        x: left,
        y: top,
        width: (right - left).max(1),
        height: (bottom - top).max(1),
    }
}

fn window_title(hwnd: HWND) -> String {
    let mut buffer = [0u16; 128];
    let length = unsafe { GetWindowTextW(hwnd, &mut buffer) };
    if length <= 0 {
        return String::new();
    }
    OsString::from_wide(&buffer[..length as usize])
        .to_string_lossy()
        .into_owned()
}

fn class_name(hwnd: HWND) -> String {
    let mut buffer = [0u16; 64];
    let length = unsafe { GetClassNameW(hwnd, &mut buffer) };
    if length <= 0 {
        return String::new();
    }
    OsString::from_wide(&buffer[..length as usize])
        .to_string_lossy()
        .into_owned()
}
