import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RegistrationStatus } from "@shelf/shared";
import { IconLock, IconLogin2, IconUserPlus } from "@tabler/icons-react";
import { login, signup } from "../../api";

interface AuthScreenProps {
  continueUrl?: string | null;
  registration: RegistrationStatus;
}

type AuthMode = "login" | "signup";

export const AuthScreen = ({ continueUrl, registration }: AuthScreenProps) => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>(registration.available ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const activeMode = registration.available ? mode : "login";
  const submitLabel = activeMode === "signup" ? "Create account" : "Log in";
  const authMutation = useMutation({
    mutationFn: async () => {
      setMessage("");

      if (activeMode === "signup") {
        return signup({
          email,
          name,
          password,
          username
        });
      }

      return login({
        email,
        password
      });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth-session"] }),
        queryClient.invalidateQueries({ queryKey: ["current-user"] })
      ]);

      if (continueUrl) {
        window.location.assign(continueUrl);
      }
    }
  });
  const canSubmit = useMemo(() => {
    if (!email.trim() || password.length < 8 || authMutation.isPending) {
      return false;
    }

    return activeMode === "login" || registration.available;
  }, [activeMode, authMutation.isPending, email, password, registration.available]);

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-4 py-8 font-sans text-slate-950">
      <section className="w-full max-w-[380px] rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-gray-200 bg-gray-50 text-slate-950">
            <IconLock size={21} stroke={1.6} aria-hidden="true" focusable="false" />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-[17px] leading-6 font-medium">Shelf</h1>
            <p className="m-0 text-sm leading-5 text-gray-500">
              {activeMode === "signup" ? "Create the first account" : "Log in to continue"}
            </p>
          </div>
        </div>

        {registration.available ? (
          <div className="mb-4 grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-100 p-1">
            <button
              className={modeButtonClass(activeMode === "login")}
              type="button"
              onClick={() => setMode("login")}
            >
              <IconLogin2 size={16} stroke={1.6} aria-hidden="true" focusable="false" />
              Log in
            </button>
            <button
              className={modeButtonClass(activeMode === "signup")}
              type="button"
              onClick={() => setMode("signup")}
            >
              <IconUserPlus size={16} stroke={1.6} aria-hidden="true" focusable="false" />
              Sign up
            </button>
          </div>
        ) : (
          <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-5 text-gray-600">
            Registration is closed for this instance.
          </p>
        )}

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();

            if (canSubmit) {
              authMutation.mutate();
            }
          }}
        >
          {activeMode === "signup" ? (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
                Name
                <input
                  className={inputClassName}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
                Username
                <input
                  className={inputClassName}
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
            </>
          ) : null}

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Email
            <input
              className={inputClassName}
              autoComplete="email"
              inputMode="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Password
            <input
              className={inputClassName}
              autoComplete={activeMode === "signup" ? "new-password" : "current-password"}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {message ? (
            <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700">
              {message}
            </p>
          ) : null}

          <button
            className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white outline-none hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            disabled={!canSubmit}
            type="submit"
          >
            {activeMode === "signup" ? (
              <IconUserPlus size={17} stroke={1.7} aria-hidden="true" focusable="false" />
            ) : (
              <IconLogin2 size={17} stroke={1.7} aria-hidden="true" focusable="false" />
            )}
            {authMutation.isPending ? "Working" : submitLabel}
          </button>
        </form>
      </section>
    </main>
  );
};

const inputClassName =
  "h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:outline-2 focus:outline-offset-1 focus:outline-blue-500";

const modeButtonClass = (isActive: boolean) =>
  [
    "inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
    isActive ? "bg-white text-slate-950 shadow-sm" : "text-gray-600 hover:text-slate-950"
  ].join(" ");
