import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
// Z `react-router/dom`: `navigate(…, { flushSync: true })` działa (T-019).
import { RouterProvider } from "react-router/dom";
import { createQueryClient } from "./queryClient";
import { routes } from "./routes";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createBrowserRouter(routes)} />
    </QueryClientProvider>
  </StrictMode>,
);
