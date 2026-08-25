import * as ReactStart from "@tanstack/react-start";
import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(error), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const reqMiddlewares = [errorMiddleware];

// Safely attach CSRF middleware if present in this TanStack Start version
const createCsrf = (ReactStart as unknown as { createCsrfMiddleware?: (opts: unknown) => unknown }).createCsrfMiddleware;
if (typeof createCsrf === "function") {
  reqMiddlewares.push(
    createCsrf({
      filter: (ctx: { handlerType: string }) => ctx.handlerType === "serverFn",
    }) as typeof errorMiddleware,
  );
}

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: reqMiddlewares,
}));
