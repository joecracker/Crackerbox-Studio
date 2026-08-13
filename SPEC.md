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

6. **Diff-aware edits** — done (`34a8c42`)
   Proposed code changes surface as a line-by-line before/after diff and must be explicitly approved or rejected before being applied to the file tree.

7. **Project library** — done (`a65bfa6`)
   Save, manage, and switch between multiple projects, each with its own file tree.

8. **Deploy Wizard** — done (`e4c35f3`)
   Guided push to GitHub and Netlify deployment, with API tokens encrypted at rest (PBKDF2 + AES-GCM).

9. **Personality / communication controls** — done (`699cfcd`)
   Tone, verbosity, and custom-instruction presets that compose into the system prompt, persisted per workspace.

10. **Chat completions with OpenRouter streaming** — in progress
    Chat wired to OpenRouter's `/api/v1/chat/completions` with SSE streaming (`useChatStream`), the Feature 4 model picker feeds the request model, the encrypted Feature 8 vault stores the OpenRouter API key, and errors (bad key, rate limits, unavailable model) surface in the chat UI. Client-side only.
