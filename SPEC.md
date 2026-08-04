# Cracker Box — Feature Spec

Status: done | in progress | planned

1. **Layout and panel system** — done (`44d1a30`)
   Resizable sidebar / file tree / main / live preview panels, collapsible with CSS transitions, persisted to localStorage.

2. **Zen mode + live preview** — done (`57f8557`)
   Distraction-free zen view and a live-rendering preview panel for the workspace.

3. **File navigation** — done (`2786e8d`)
   Demo project tree with folders, files, search/filter, keyboard navigation, and a read-only file viewer.

4. **Models and generation controls** — done (`1fb69ab`, `f0f5975`)
   Model picker with live OpenRouter model fetch (free-model filter), system prompt, temperature, and max-token controls in a parameters dialog.

5. **Command palette, shortcuts, context menu** — done (`1c0629a`, `ddda6c7`, `ac4f103`)
   Ctrl+K command palette, keyboard shortcuts (gated while any dialog is open), shortcut reference overlay, and a right-click context menu with file-specific actions.

6. **Diff-aware edits** — in progress
   Proposed code changes surface as a line-by-line before/after diff and must be explicitly approved or rejected before being applied to the file tree.

7. **Project library** — planned
   Save, manage, and switch between multiple projects.

8. **Deploy Wizard** — planned
   Guided push to GitHub and Netlify deployment.

9. **Personality / communication controls** — planned
   Adjust how the assistant communicates (tone, style, verbosity).
