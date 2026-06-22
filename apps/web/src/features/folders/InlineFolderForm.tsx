import { type ReactNode, useEffect, useRef, useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { DEFAULT_FOLDER_ICON_COLOR, DEFAULT_FOLDER_ICON_NAME } from "./folderIcons";
import { FolderIconPickerDropdown } from "./FolderIconPickerDropdown";
import type { FolderFormValue } from "./types";

export const InlineFolderForm = ({
  defaultValue = "",
  defaultIconColor = null,
  defaultIconName = null,
  error,
  isPending,
  leadingSlot,
  submitLabel,
  onCancel,
  onSubmit
}: {
  defaultValue?: string;
  defaultIconColor?: string | null;
  defaultIconName?: string | null;
  error: string | null;
  isPending: boolean;
  leadingSlot?: ReactNode;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (value: FolderFormValue) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(defaultValue);
  const [iconName, setIconName] = useState(defaultIconName ?? DEFAULT_FOLDER_ICON_NAME);
  const [iconColor, setIconColor] = useState(defaultIconColor ?? DEFAULT_FOLDER_ICON_COLOR);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isNameInvalid, setIsNameInvalid] = useState(false);
  const [isNameShaking, setIsNameShaking] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const triggerNameValidation = () => {
    setIsNameInvalid(true);
    setIsNameShaking(false);
    requestAnimationFrame(() => setIsNameShaking(true));
    inputRef.current?.focus();
  };

  const updateName = (value: string) => {
    setName(value);
    if (value.trim()) {
      setIsNameInvalid(false);
    }
  };

  return (
    <form
      className="grid min-h-8 min-w-0 grid-cols-[minmax(0,1fr)_1.5rem_1.75rem] items-center gap-1"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const trimmedName = String(formData.get("name") ?? "").trim();

        if (!trimmedName) {
          triggerNameValidation();
          return;
        }

        onSubmit({
          iconColor,
          iconName,
          name: trimmedName
        });
      }}
    >
      <div className="flex min-w-0 items-center gap-0.5">
        {leadingSlot}
        <FolderIconPickerDropdown
          iconColor={iconColor}
          iconName={iconName}
          isOpen={isIconPickerOpen}
          onCancel={() => setIsIconPickerOpen(false)}
          onCommit={(nextIconName, nextIconColor) => {
            setIconName(nextIconName);
            setIconColor(nextIconColor);
            setIsIconPickerOpen(false);
          }}
          onOpenChange={setIsIconPickerOpen}
        />
        <div className="ml-1.5 min-w-0 flex-1">
          <input
            className={[
              "min-h-7 w-full min-w-0 rounded-md border bg-transparent px-1.5 text-[13px] font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad]",
              isNameInvalid
                ? "border-[#ef4444] ring-3 ring-[#fee2e2]"
                : "border-transparent",
              isNameShaking ? "field-shake" : ""
            ].join(" ")}
            aria-label="Folder title"
            aria-invalid={isNameInvalid}
            autoComplete="off"
            data-1p-ignore="true"
            data-op-ignore="true"
            name="name"
            placeholder="Folder title"
            ref={inputRef}
            value={name}
            onAnimationEnd={() => setIsNameShaking(false)}
            onChange={(event) => updateName(event.target.value)}
            onInput={(event) => updateName(event.currentTarget.value)}
          />
        </div>
      </div>
      <button
        className="grid h-7 w-6 place-items-center rounded-lg border border-transparent bg-transparent text-[#697080] outline-none hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
        aria-label="Cancel"
        disabled={isPending}
        title="Cancel"
        type="button"
        onClick={onCancel}
      >
        <IconX size={14} stroke={1.5} aria-hidden="true" focusable="false" />
      </button>
      <button
        className="grid h-7 w-7 place-items-center rounded-lg border border-transparent bg-transparent text-[#3b8df5] outline-none hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:text-[#91bff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
        aria-label={isPending ? "Saving" : submitLabel}
        disabled={isPending}
        title={isPending ? "Saving" : submitLabel}
        type="submit"
      >
        <IconCheck size={15} stroke={1.8} aria-hidden="true" focusable="false" />
      </button>
      {error ? (
        <p className="col-span-3 m-0 text-xs font-medium text-[#9a4d0a]">{error}</p>
      ) : null}
    </form>
  );
};
