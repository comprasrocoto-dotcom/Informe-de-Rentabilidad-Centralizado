"use client";

import { useState } from "react";
import { LogoCompleto } from "@/components/Logo";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

type Modo = "ingresar" | "crear" | "olvide";

function traducirError(msg: string): string {
  if (/database error saving new user|CORREO_NO_AUTORIZADO/i.test(msg))
    return "Este correo no está autorizado. Pídele al administrador que lo registre para tu marca.";
  if (/invalid login credentials/i.test(msg)) return "Correo o clave incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Aún no confirmas tu correo. Revisa tu bandeja de entrada (y spam).";
  if (/already registered/i.test(msg)) return "Este correo ya tiene cuenta. Usa “Ingresar” u “Olvidé mi clave”.";
  if (/password should be at least/i.test(msg)) return "La clave debe tener al menos 6 caracteres.";
  if (/rate limit/i.test(msg)) return "Se enviaron demasiados correos. Espera unos minutos e intenta de nuevo.";
  return msg;
}

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("ingresar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setCargando(true);
    const sb = crearClienteNavegador();
    const correo = email.trim().toLowerCase();
    const origen = window.location.origin;
    try {
      if (modo === "ingresar") {
        const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      } else if (modo === "crear") {
        const { data, error } = await sb.auth.signUp({
          email: correo,
          password: clave,
          options: { emailRedirectTo: `${origen}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setAviso("Cuenta creada. Te enviamos un correo para confirmarla; ábrelo y luego ingresa con tu clave.");
          setModo("ingresar");
        }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(correo, {
          redirectTo: `${origen}/auth/callback?next=/actualizar-clave`,
        });
        if (error) throw error;
        setAviso("Si el correo tiene cuenta, te llegará un enlace para crear una clave nueva.");
      }
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : String(err)));
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,520px)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-carbon p-12 text-white lg:flex">
        <div><LogoCompleto oscuro size={44} /></div>
        <div className="max-w-md">
          <p className="text-[34px] leading-[1.15] font-semibold tracking-tight">
            Cuánto cuesta lo que vendes, sede por sede y mes a mes.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Ventas, compras, inventarios y traslados de cada marca en un solo lugar, con el costo de venta de Cocina y Bar calculado igual para todas.
          </p>
        </div>
        <svg className="pointer-events-none absolute -right-24 -bottom-24 h-[420px] w-[420px] text-white/[0.06]" viewBox="0 0 200 200" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={20 + i * 28} y={170 - (i + 1) * 24} width="18" height={(i + 1) * 24} rx="3" fill="currentColor" />
          ))}
        </svg>
        <div className="text-xs text-white/50">Cada marca entra con su correo y solo ve su información.</div>
      </section>

      <section className="flex items-center justify-center bg-white p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden"><LogoCompleto /></div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-tinta max-lg:hidden">
            {modo === "ingresar" ? "Ingresa a tu cuenta" : modo === "crear" ? "Activa tu cuenta" : "Recupera tu clave"}
          </h2>
          <p className="mt-1 mb-6 text-sm text-texto-2">
            {modo === "ingresar" ? "Usa el correo registrado para tu marca." : modo === "crear" ? "Solo para correos que el administrador ya registró. Aquí eliges tu clave." : "Te enviaremos un enlace para crear una clave nueva."}
          </p>

          <form onSubmit={enviar} className="space-y-4">
            <label className="block">
              <span className="etiqueta">Correo</span>
              <input className="campo w-full" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {modo !== "olvide" && (
              <label className="block">
                <span className="etiqueta">Clave</span>
                <input
                  className="campo w-full" type="password" required minLength={6}
                  autoComplete={modo === "crear" ? "new-password" : "current-password"}
                  value={clave} onChange={(e) => setClave(e.target.value)}
                />
              </label>
            )}
            {error && <p className="rounded-md bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
            {aviso && <p className="rounded-md bg-marca-suave p-2.5 text-sm text-marca">{aviso}</p>}
            <button className="boton h-10 w-full" disabled={cargando}>
              {cargando ? "Un momento…" : modo === "ingresar" ? "Ingresar" : modo === "crear" ? "Crear mi clave" : "Enviar enlace"}
            </button>
          </form>

          <div className="mt-6 space-y-2 border-t border-linea pt-5 text-sm text-texto-2">
            {modo !== "ingresar" && (
              <button type="button" className="block font-medium text-marca hover:underline" onClick={() => { setModo("ingresar"); setError(null); setAviso(null); }}>
                Ya tengo clave: ingresar
              </button>
            )}
            {modo !== "crear" && (
              <button type="button" className="block font-medium text-marca hover:underline" onClick={() => { setModo("crear"); setError(null); setAviso(null); }}>
                Primera vez: activar mi cuenta
              </button>
            )}
            {modo !== "olvide" && (
              <button type="button" className="block font-medium text-marca hover:underline" onClick={() => { setModo("olvide"); setError(null); setAviso(null); }}>
                Olvidé mi clave
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
