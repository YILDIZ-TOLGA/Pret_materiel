import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { User } from "@prisma/client";
import { getCurrentUser } from "./auth";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export const zodError = (e: ZodError) => error(e.issues.map((i) => i.message).join(", "), 400);

type Handler<C> = (user: User, req: Request, ctx: C) => Promise<Response>;

export function withUser<C = unknown>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    const user = await getCurrentUser();
    if (!user) return error("Non connecté", 401);
    return fn(user, req, ctx);
  };
}

export function withAdmin<C = unknown>(fn: Handler<C>) {
  return withUser<C>(async (user, req, ctx) => {
    if (user.role !== "ADMIN") return error("Accès refusé", 403);
    return fn(user, req, ctx);
  });
}
