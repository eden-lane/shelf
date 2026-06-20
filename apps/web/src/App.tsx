import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProductShell } from "./components/ProductShell";

export const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ProductShell />
    </QueryClientProvider>
  );
};

export default App;
