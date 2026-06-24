export const savePanelStyles = `
:host {
  all: initial;
  color: #20242d;
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
  top: max(14px, env(safe-area-inset-top));
  right: max(14px, env(safe-area-inset-right));
  width: min(340px, calc(100vw - 28px));
  max-height: calc(100vh - 28px);
  pointer-events: auto;
}

.shelf-panel-layer {
  position: fixed;
  inset: 0;
  pointer-events: auto;
}

.shelf-panel {
  overflow: visible;
  display: grid;
  gap: 10px;
  width: 100%;
  max-height: calc(100vh - 28px);
  border: 1px solid rgb(15 23 42 / 12%);
  border-radius: 8px;
  padding: 12px;
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 18px 48px rgb(15 23 42 / 18%);
  backdrop-filter: blur(18px) saturate(1.2);
}

.shelf-panel-header,
.shelf-brand,
.shelf-header-actions,
.shelf-field-row,
.shelf-folder-trigger,
.shelf-folder-trigger-content {
  display: flex;
  align-items: center;
}

.shelf-panel-header,
.shelf-field-row,
.shelf-folder-trigger {
  justify-content: space-between;
  gap: 8px;
}

.shelf-brand {
  min-width: 0;
  gap: 8px;
}

.shelf-brand-mark {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  color: #20242d;
  background: #f8fafc;
  font-size: 14px;
  font-weight: 500;
}

.shelf-eyebrow {
  margin: 0 0 1px;
  color: #697080;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #111827;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.25;
}

.shelf-header-actions {
  gap: 6px;
}

.shelf-icon-button,
.shelf-text-button {
  border: 1px solid #dfe4ef;
  border-radius: 7px;
  color: #4b5262;
  background: #fff;
  cursor: pointer;
}

.shelf-icon-button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
}

.shelf-text-button {
  min-height: 30px;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 500;
}

.shelf-icon-button:hover,
.shelf-text-button:hover,
.shelf-folder-trigger:hover,
.shelf-folder-tree-row:hover,
.shelf-tag-menu-option:hover {
  background: #f7f8fc;
}

.shelf-icon-button:focus,
.shelf-text-button:focus,
.shelf-folder-trigger:focus,
.shelf-folder-select-button:focus,
.shelf-disclosure-button:focus,
.shelf-save-button:focus,
.shelf-tag-menu-option:focus,
.shelf-tag-input-wrap:focus-within {
  outline: 2px solid rgb(59 141 245 / 22%);
  outline-offset: 1px;
}

.shelf-page-card {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 7px;
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
  gap: 6px;
  padding: 8px;
  color: #697080;
  background: #eef2f7;
  text-align: center;
}

.shelf-preview-fallback img {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}

.shelf-preview-fallback span {
  overflow: hidden;
  max-width: 100%;
  font-size: 12px;
  font-weight: 400;
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
.shelf-saved-banner p,
.shelf-folder-group-label {
  margin: 0;
}

.shelf-page-title {
  overflow: hidden;
  color: #20242d;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.shelf-page-url {
  overflow: hidden;
  margin-top: 3px;
  color: #697080;
  font-size: 12px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-page-description {
  overflow: hidden;
  margin-top: 5px;
  color: #4b5262;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.shelf-saved-banner {
  display: grid;
  gap: 3px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 8px 9px;
  color: #1e3a8a;
  background: #eff6ff;
}

.shelf-saved-banner p,
.shelf-saved-banner span {
  font-size: 12px;
  font-weight: 500;
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
  gap: 10px;
}

.shelf-field {
  gap: 5px;
  color: #4b5262;
  font-size: 12px;
  font-weight: 500;
}

.shelf-folder-combobox,
.shelf-tag-combobox {
  position: relative;
}

.shelf-folder-trigger {
  width: 100%;
  min-height: 34px;
  border: 1px solid #dfe4ef;
  border-radius: 7px;
  padding: 6px 8px;
  color: #20242d;
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
  gap: 7px;
}

.shelf-folder-trigger-content span {
  overflow: hidden;
  font-size: 13px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-folder-list,
.shelf-tag-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  overflow-y: auto;
  border: 1px solid #dfe4ef;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 14px 38px rgb(22 28 43 / 16%);
}

.shelf-folder-list {
  display: grid;
  align-content: start;
  max-height: min(250px, calc(100vh - 190px));
  padding: 5px;
}

.shelf-folder-group + .shelf-folder-group {
  margin-top: 5px;
  padding-top: 5px;
  border-top: 1px solid #eef1f6;
}

.shelf-folder-group-label {
  padding: 5px 8px 4px;
  color: #697080;
  font-size: 12px;
  font-weight: 500;
}

.shelf-folder-tree-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 28px;
  align-items: center;
  min-height: 32px;
  border-radius: 7px;
  background: transparent;
  color: #20242d;
}

.shelf-folder-tree-row.is-selected {
  background: #f0f6ff;
}

.shelf-disclosure-button,
.shelf-folder-select-button {
  border: 0;
  background: transparent;
}

.shelf-disclosure-button,
.shelf-disclosure-placeholder {
  display: grid;
  width: 24px;
  height: 30px;
  place-items: center;
  border-radius: 7px;
  color: #697080;
}

.shelf-disclosure-button {
  cursor: pointer;
}

.shelf-disclosure-button:disabled {
  cursor: default;
}

.shelf-folder-select-button {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 32px;
  padding: 0 7px 0 0;
  color: #20242d;
  text-align: left;
  cursor: pointer;
}

.shelf-folder-select-button span {
  overflow: hidden;
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-folder-count {
  display: grid;
  min-width: 0;
  height: 30px;
  place-items: center;
  color: #9aa1ad;
  font-size: 12px;
  font-weight: 400;
}

.shelf-tag-input-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-height: 36px;
  border: 1px solid #dfe4ef;
  border-radius: 7px;
  padding: 5px 7px;
  background: #fff;
  cursor: text;
}

.shelf-tag-input-wrap input {
  min-width: 90px;
  flex: 1;
  border: 0;
  padding: 2px 0;
  color: #20242d;
  background: transparent;
  font-size: 13px;
  font-weight: 400;
  outline: 0;
}

.shelf-tag-input-wrap input::placeholder {
  color: #9aa1ad;
}

.shelf-tag-token {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  padding: 3px 6px;
  color: #334155;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
}

.shelf-tag-token::before,
.shelf-tag-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--tag-color);
  content: "";
  flex: 0 0 auto;
}

.shelf-tag-token span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-tag-menu {
  max-height: min(220px, calc(100vh - 210px));
  padding: 4px;
}

.shelf-tag-menu-option {
  display: grid;
  grid-template-columns: 16px 10px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 32px;
  border: 0;
  border-radius: 7px;
  padding: 6px 8px;
  color: #4b5262;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.shelf-tag-menu-option[aria-selected="true"] {
  color: #20242d;
  background: #f0f6ff;
}

.shelf-tag-menu-check {
  color: #3b8df5;
}

.shelf-tag-menu-option span:last-child {
  overflow: hidden;
  min-width: 0;
  font-size: 13px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shelf-message {
  min-height: 16px;
  color: #697080;
  font-size: 12px;
  font-weight: 400;
}

.shelf-message[data-tone="error"] {
  color: #b91c1c;
}

.shelf-message[data-tone="success"] {
  color: #15803d;
}

.shelf-save-button {
  min-height: 36px;
  border: 0;
  border-radius: 8px;
  color: #fff;
  background: #111827;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.shelf-save-button:hover {
  background: #0f172a;
}

.shelf-empty-state {
  padding: 8px;
  color: #697080;
  font-size: 12px;
  font-weight: 400;
}

@media (max-width: 480px) {
  .shelf-overlay-frame {
    top: max(10px, env(safe-area-inset-top));
    right: 10px;
    left: 10px;
    width: auto;
  }

  .shelf-page-card {
    grid-template-columns: 70px minmax(0, 1fr);
  }
}
`;
