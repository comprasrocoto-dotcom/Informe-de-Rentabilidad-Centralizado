"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/client";

export default function ActualizarClave() {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (clave !== clave2) return setError("Las dos claves no coinciden.");
    setCargando(true);
    setError(null);
    const { error } = await crearClienteNavegador().auth.updateUser({ password: clave });
    setCargando(false);
    if (error) return setError(error.message);
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={guardar} className="tarjeta w-full max-w-sm space-y-3">
        <h1 className="text-lg font-semibold">Crea tu clave nueva</h1>
        <input className="campo w-full" type="password" placeholder="Clave nueva" minLength={6} required value={clave} onChange={(e) => setClave(e.target.value)} />
        <input className="campo w-full" type="password" placeholder="Repite la clave" minLength={6} required value={clave2} onChange={(e) => setClave2(e.target.value)} />
        {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button className="boton w-full" disabled={cargando}>{cargando ? "Guardando…" : "Guardar clave"}</button>
      </form>
    </main>
  );
}
