#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[cfg(windows)]
mod desktop;
#[cfg(windows)]
fn main() {
    desktop::run();
}
#[cfg(not(windows))]
fn main() {
    eprintln!("Persona Companion targets Windows. Run cargo test for portable core checks.");
}
