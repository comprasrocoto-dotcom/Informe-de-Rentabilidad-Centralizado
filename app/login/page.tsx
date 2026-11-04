"use client";

import { useState } from "react";
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
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Informe de Rentabilidad</h1>
        <p className="mb-6 text-sm text-stone-500">Ingresa con el correo de tu marca.</p>

        <div className="mb-4 flex gap-1 rounded-lg bg-stone-200/60 p-1 text-sm">
          {(["ingresar", "crear", "olvide"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setModo(m); setError(null); setAviso(null); }}
              className={`flex-1 rounded-md px-2 py-1.5 ${modo === m ? "bg-white font-medium shadow-sm" : "text-stone-600"}`}
            >
              {m === "ingresar" ? "Ingresar" : m === "crear" ? "Activar cuenta" : "Olvidé mi clave"}
            </button>
          ))}
        </div>

        <form onSubmit={enviar} className="tarjeta space-y-3">
          {modo === "crear" && (
            <p className="text-xs text-stone-500">
              Solo funciona con correos que el administrador ya registró para una marca. Elige aquí tu clave.
            </p>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">Correo</span>
            <input className="campo w-full" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {modo !== "olvide" && (
            <label className="block text-sm">
              <span className="mb-1 block text-stone-600">Clave</span>
              <input
                className="campo w-full" type="password" required minLength={6}
                autoComplete={modo === "crear" ? "new-password" : "current-password"}
                value={clave} onChange={(e) => setClave(e.target.value)}
              />
            </label>
          )}
          {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          {aviso && <p className="rounded-md bg-green-50 p-2 text-sm text-green-800">{aviso}</p>}
          <button className="boton w-full" disabled={cargando}>
            {cargando ? "Un momento…" : modo === "ingresar" ? "Ingresar" : modo === "crear" ? "Crear mi clave" : "Enviar enlace"}
          </button>
        </form>
      </div>
    </main>
  );
}
