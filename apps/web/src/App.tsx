import { useState } from "react";
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAuthSession } from "./api";
import { ProductShell } from "./components/ProductShell";
import { AuthScreen } from "./features/auth/AuthScreen";

export const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

const AppContent = () => {
  const authSession = useQuery({
    queryKey: ["auth-session"],
    queryFn: getAuthSession
  });

  if (authSession.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-gray-50 font-sans text-sm text-gray-500">
        Loading
      </main>
    );
  }

  if (!authSession.data?.user) {
    return (
      <AuthScreen
        registration={authSession.data?.registration ?? { available: false, mode: "closed" }}
      />
    );
  }

  return <ProductShell />;
};

export default App;
