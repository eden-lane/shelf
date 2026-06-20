export const CONTEXT_MENU_MARGIN = 8;

export const FOLDER_CONTEXT_MENU_SIZE = { height: 172, width: 190 };
export const BOOKMARK_CONTEXT_MENU_SIZE = { height: 128, width: 160 };

export const clampContextMenuPosition = (
  x: number,
  y: number,
  size: { height: number; width: number }
) => {
  const viewportWidth =
    typeof window === "undefined" ? size.width + CONTEXT_MENU_MARGIN * 2 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? size.height + CONTEXT_MENU_MARGIN * 2 : window.innerHeight;
  const maxX = Math.max(CONTEXT_MENU_MARGIN, viewportWidth - size.width - CONTEXT_MENU_MARGIN);
  const maxY = Math.max(CONTEXT_MENU_MARGIN, viewportHeight - size.height - CONTEXT_MENU_MARGIN);

  return {
    x: Math.min(Math.max(CONTEXT_MENU_MARGIN, x), maxX),
    y: Math.min(Math.max(CONTEXT_MENU_MARGIN, y), maxY)
  };
};
