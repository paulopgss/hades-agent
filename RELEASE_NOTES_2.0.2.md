# Hades Agent 2.0.2 Release Notes

## 🚀 Improvements & Fixes

* **Susurro Recording Stability**: Addressed a critical race condition that could cause "Failed to start audio recording" errors during rapid UI events. Synchronous ref-based tracking was implemented to stabilize the recording state when the window loses focus.
* **UI Refinements**: 
  * Removed the deprecated window-minimizing icon from the interface to reduce clutter.
  * Corrected the styling for the token cost popup so that information is fully visible without truncation.
* **General Cleanup**: Removed associated unused CSS styles.

---
*Built with ❤️ for a better AI agent experience.*
