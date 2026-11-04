import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Destino de los enlaces que llegan por correo (confirmar cuenta / recuperar clave).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const destino = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
