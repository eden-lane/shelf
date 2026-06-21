import { useEffect, useRef, useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";

export const DEFAULT_TAG_COLOR = "#3b82f6";

export type TagFormValue = {
  name: string;
  color: string;
};

const TAG_COLORS = [
  "#3b82f6",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#0891b2",
  "#64748b"
];

export const InlineTagForm = ({
  defaultColor,
  defaultName,
  error,
  isPending,
  submitLabel = "Create tag",
  onCancel,
  onSubmit
}: {
  defaultColor?: string | null;
  defaultName?: string;
  error: string | null;
  isPending: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (value: TagFormValue) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(defaultName ?? "");
  const [color, setColor] = useState(defaultColor ?? DEFAULT_TAG_COLOR);
  const [isNameInvalid, setIsNameInvalid] = useState(false);
  const [isNameShaking, setIsNameShaking] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const updateName = (value: string) => {
    setName(value);
    if (value.trim()) {
      setIsNameInvalid(false);
    }
  };

  const triggerNameValidation = () => {
    setIsNameInvalid(true);
    setIsNameShaking(false);
    requestAnimationFrame(() => setIsNameShaking(true));
    inputRef.current?.focus();
  };

  const submitTag = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      triggerNameValidation();
      return;
    }

    onSubmit({ color, name: trimmedName });
  };

  return (
    <form
      className="grid gap-2 rounded-lg border border-[#dfe4ef] bg-white p-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submitTag();
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <input
          className={[
            "min-h-8 min-w-0 flex-1 rounded-md border bg-transparent px-1.5 text-sm font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad]",
            isNameInvalid ? "border-[#ef4444] ring-3 ring-[#fee2e2]" : "border-transparent",
            isNameShaking ? "field-shake" : ""
          ].join(" ")}
          aria-label="Tag name"
          aria-invalid={isNameInvalid}
          name="name"
          placeholder="Tag name"
          ref={inputRef}
          value={name}
          onAnimationEnd={() => setIsNameShaking(false)}
          onChange={(event) => updateName(event.target.value)}
          onInput={(event) => updateName(event.currentTarget.value)}
        />
        <button
          className="grid h-8 w-7 place-items-center rounded-lg border border-transparent bg-transparent text-[#697080] outline-none hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          aria-label="Cancel"
          disabled={isPending}
          title="Cancel"
          type="button"
          onClick={onCancel}
        >
          <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
        </button>
        <button
          className="grid h-8 w-8 place-items-center rounded-lg border border-transparent bg-transparent text-[#3b8df5] outline-none hover:bg-[#eef6ff] disabled:cursor-not-allowed disabled:text-[#91bff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          aria-label={isPending ? "Saving" : submitLabel}
          disabled={isPending}
          title={isPending ? "Saving" : submitLabel}
          type="submit"
          onClick={(event) => {
            event.preventDefault();
            submitTag();
          }}
        >
          <IconCheck size={17} stroke={1.8} aria-hidden="true" focusable="false" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Tag colors">
        {TAG_COLORS.map((tagColor) => (
          <button
            className={[
              "grid h-6 w-6 place-items-center rounded-full border outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
              color === tagColor ? "border-slate-950" : "border-transparent"
            ].join(" ")}
            aria-label={`Select tag color ${tagColor}`}
            key={tagColor}
            title={tagColor}
            type="button"
            onClick={() => setColor(tagColor)}
          >
            <span
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: tagColor }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      {error ? <p className="m-0 text-xs font-bold text-[#9a4d0a]">{error}</p> : null}
    </form>
  );
};
