export const savePanelStyles = `
:host {
  all: initial;
  color: #18181b;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

button,
input {
  font: inherit;
}

.shelf-overlay-frame {
  position: fixed;
  top: max(16px, env(safe-area-inset-top));
  right: max(16px, env(safe-area-inset-right));
  width: min(390px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  pointer-events: auto;
}

.shelf-panel {
  overflow: hidden;
  display: grid;
  gap: 14px;
  width: 100%;
  max-height: calc(100vh - 32px);
  border: 1px solid rgb(15 23 42 / 12%);
  border-radius: 8px;
  padding: 14px;
  background: rgb(255 255 255 / 96%);
  box-shadow:
    0 24px 60px rgb(15 23 42 / 22%),
    0 1px 0 rgb(255 255 255 / 72%) inset;
  backdrop-filter: blur(18px) saturate(1.25);
}

.shelf-picker-panel {
  grid-template-rows: auto auto minmax(0, 1fr);
  min-height: 420px;
}

.shelf-panel-header,
.shelf-brand,
.shelf-header-actions,
.shelf-field-row,
.shelf-folder-trigger,
.shelf-folder-trigger-content,
.shelf-library-row,
.shelf-folder-row-label,
.shelf-picker-nav {
  display: flex;
  align-items: center;
}

.shelf-panel-header {
  justify-content: space-between;
  gap: 12px;
}

.shelf-brand {
  min-width: 0;
  gap: 10px;
}

.shelf-brand-mark {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #111827;
  background: #f8fafc;
  font-size: 15px;
  font-weight: 800;
}

.shelf-eyebrow {
  margin: 0 0 2px;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #111827;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.15;
}

.shelf-header-actions {
  gap: 6px;
}

.shelf-icon-button,
.shelf-text-button {
  border: 1px solid #e5e7eb;
  border-radius: 7px;
  color: #334155;
  background: #fff;
  cursor: pointer;
}

.shelf-icon-button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
}

.shelf-text-button {
  min-height: 32px;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 800;
}

.shelf-icon-button:hover,
.shelf-text-button:hover,
.shelf-folder-trigger:hover,
.shelf-library-row:hover,
.shelf-folder-tree-row:hover {
  background: #f8fafc;
}

.shelf-icon-button:focus,
.shelf-text-button:focus,
.shelf-folder-trigger:focus,
.shelf-folder-select-button:focus,
.shelf-disclosure-button:focus,
.shelf-save-button:focus {
  outline: 3px solid rgb(37 99 235 / 18%);
  outline-offset: 1px;
}

.shelf-page-card {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
  background: #f8fafc;
}

.shelf-preview-media {
  overflow: hidden;
  position: relative;
  aspect-ratio: 4 / 3;
  border: 1px solid #e5e7eb;
  border-radius: 7px;
  background: #e2e8f0;
}

.shelf-preview-media > img,
.shelf-preview-fallback {
  width: 100%;
  height: 100%;
}

.shelf-preview-media > img {
  display: block;
  object-fit: cover;
}

.shelf-preview-fallback {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 8px;
  padding: 10px;
  color: #475569;
  background:
    linear-gradient(135deg, #f8fafc 0%, #e2e8f0 45%, #cbd5e1 100%);
  text-align: center;
}

.shelf-preview-fallback img {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.shelf-preview-fallback span {
  overflow: hidden;
  max-width: 100%;
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-page-copy {
  min-width: 0;
}

.shelf-page-title,
.shelf-page-url,
.shelf-page-description,
.shelf-message,
.shelf-empty-state,
.shelf-saved-banner p {
  margin: 0;
}

.shelf-page-title {
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.28;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.shelf-page-url {
  overflow: hidden;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-page-description {
  overflow: hidden;
  margin-top: 7px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.shelf-saved-banner {
  display: grid;
  gap: 4px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 9px 10px;
  color: #1e3a8a;
  background: #eff6ff;
}

.shelf-saved-banner p,
.shelf-saved-banner span {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.3;
}

.shelf-saved-banner span {
  overflow-wrap: anywhere;
  color: #1d4ed8;
}

.shelf-form,
.shelf-field {
  display: grid;
}

.shelf-form {
  gap: 12px;
}

.shelf-field {
  gap: 6px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}

.shelf-field-row,
.shelf-folder-trigger,
.shelf-library-row,
.shelf-picker-nav {
  justify-content: space-between;
  gap: 8px;
}

.shelf-folder-trigger {
  width: 100%;
  min-height: 38px;
  border: 1px solid #dbe3ef;
  border-radius: 7px;
  padding: 7px 9px;
  color: #111827;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.shelf-folder-trigger:disabled,
.shelf-icon-button:disabled,
.shelf-save-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.shelf-folder-trigger-content {
  min-width: 0;
  gap: 8px;
}

.shelf-folder-trigger-content span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 110px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
  background: #fff;
}

.shelf-tag-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 5px 8px;
  color: #334155;
  background: linear-gradient(180deg, #fff, #f8fafc);
  font-size: 12px;
  font-weight: 800;
}

.shelf-tag-option::before {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--tag-color);
  content: "";
}

.shelf-tag-option input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #2563eb;
}

.shelf-tag-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-message {
  min-height: 18px;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.shelf-message[data-tone="error"] {
  color: #b91c1c;
}

.shelf-message[data-tone="success"] {
  color: #15803d;
}

.shelf-save-button {
  min-height: 42px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #111827;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.shelf-save-button:hover {
  background: #0f172a;
}

.shelf-folder-list {
  display: grid;
  align-content: start;
  gap: 1px;
  min-height: 0;
  overflow: auto;
  border-radius: 8px;
  padding: 6px;
  background: #f1f5f9;
}

.shelf-library-row {
  width: 100%;
  min-height: 42px;
  border: 0;
  border-radius: 7px;
  padding: 7px 9px;
  color: #111827;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.shelf-folder-row-label {
  min-width: 0;
  gap: 8px;
}

.shelf-folder-row-label > span {
  min-width: 0;
}

.shelf-library-row strong,
.shelf-folder-row-label strong {
  overflow: hidden;
  display: block;
  color: #111827;
  font-size: 13px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-library-row small {
  display: block;
  margin-top: 2px;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}

.shelf-folder-tree-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 32px;
  align-items: center;
  min-height: 36px;
  border-radius: 7px;
  background: transparent;
  color: #111827;
}

.shelf-folder-tree-row.is-selected {
  background: #e2e8f0;
}

.shelf-disclosure-button,
.shelf-folder-select-button {
  border: 0;
  background: transparent;
}

.shelf-disclosure-button {
  display: grid;
  width: 26px;
  height: 32px;
  place-items: center;
  border-radius: 7px;
  color: #64748b;
  cursor: pointer;
}

.shelf-disclosure-button:disabled {
  cursor: default;
}

.shelf-folder-select-button {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 36px;
  padding: 0 8px 0 0;
  color: #111827;
  text-align: left;
  cursor: pointer;
}

.shelf-folder-select-button span {
  overflow: hidden;
  min-width: 0;
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-folder-count {
  display: grid;
  min-width: 0;
  height: 32px;
  place-items: center;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 900;
}

.shelf-empty-state {
  padding: 8px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 480px) {
  .shelf-overlay-frame {
    top: max(10px, env(safe-area-inset-top));
    right: 10px;
    left: 10px;
    width: auto;
  }

  .shelf-page-card {
    grid-template-columns: 80px minmax(0, 1fr);
  }
}
`;
