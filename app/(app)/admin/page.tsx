"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";

type Acceso = { email: string; marca_id: number | null; rol: "admin" | "marca" };
type PerfilFila = { email: string; created_at: string };
type Alias = { marca_id: number; alias: string; sede_id: number };

export default function Admin() {
  const { sb, perfil, marcas, sedes, recargarCatalogos } = useApp();
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [activos, setActivos] = useState<Map<string, string>>(new Map());
  const [alias, setAlias] = useState<Alias[]>([]);
  const [nuevo, setNuevo] = useState<{ email: string; marca_id: string; rol: "marca" | "admin" }>({ email: "", marca_id: "", rol: "marca" });
  const [nuevaMarca, setNuevaMarca] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function cargar() {
    const [a, p, al] = await Promise.all([
      sb.from("accesos").select("email,marca_id,rol").order("email"),
      sb.from("perfiles").select("email,created_at"),
      sb.from("sede_alias").select("marca_id,alias,sede_id").order("alias"),
    ]);
    setAccesos((a.data as Acceso[]) ?? []);
    setActivos(new Map(((p.data as PerfilFila[]) ?? []).map((x) => [x.email, x.created_at])));
    setAlias((al.data as Alias[]) ?? []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);

  if (perfil.rol !== "admin") return <p className="text-sm text-stone-600">Esta sección es solo para el administrador.</p>;

  const avisar = (ok: boolean, texto: string) => setMsg({ ok, texto });
  const marcaNombre = (id: number | null) => marcas.find((m) => m.id === id)?.nombre ?? "—";

  async function agregarAcceso(e: React.FormEvent) {
    e.preventDefault();
    const email = nuevo.email.trim().toLowerCase();
    if (nuevo.rol === "marca" && !nuevo.marca_id) return avisar(false, "Elige la marca del correo.");
    const { error } = await sb.from("accesos").upsert({
      email, rol: nuevo.rol, marca_id: nuevo.rol === "admin" ? null : Number(nuevo.marca_id),
    });
    if (error) return avisar(false, error.message);
    setNuevo({ email: "", marca_id: "", rol: "marca" });
    avisar(true, `Listo. ${email} ya puede entrar a la página y usar “Activar cuenta” para crear su clave.`);
    cargar();
  }

  async function quitarAcceso(email: string) {
    if (email === perfil.email) return avisar(false, "No puedes quitarte tu propio acceso de administrador.");
    if (!confirm(`¿Quitar el acceso de ${email}? Ya no verá ningún dato.`)) return;
    const { error } = await sb.from("accesos").delete().eq("email", email);
    if (error) return avisar(false, error.message);
    avisar(true, `Acceso de ${email} retirado.`);
    cargar();
  }

  async function crearMarca(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nuevaMarca.trim().toUpperCase();
    if (!nombre) return;
    const { error } = await sb.from("marcas").insert({ nombre });
    if (error) return avisar(false, error.message);
    setNuevaMarca("");
    avisar(true, `Marca ${nombre} creada.`);
    recargarCatalogos();
  }

  async function cambiarTipo(id: number, tipo: string) {
    const { error } = await sb.from("sedes").update({ tipo }).eq("id", id);
    if (error) return avisar(false, error.message);
    recargarCatalogos();
  }

  async function reasignar(a: Alias, destino: number) {
    const { error } = await sb.rpc("reasignar_alias", { p_marca: a.marca_id, p_alias: a.alias, p_sede_destino: destino });
    if (error) return avisar(false, error.message);
    avisar(true, `“${a.alias}” ahora cuenta como ${sedes.find((s) => s.id === destino)?.nombre}.`);
    cargar();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Administración</h1>
      {msg && <p className={`rounded-md p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.texto}</p>}

      <section className="tarjeta">
        <h2 className="mb-1 font-medium">Correos con acceso</h2>
        <p className="mb-3 text-sm text-stone-600">
          Registra aquí el correo de cada marca. Luego esa persona entra a la página, elige <b>“Activar cuenta”</b> y crea su propia clave
          (le llega un correo para confirmar). Cada marca solo ve sus datos.
        </p>
        <form onSubmit={agregarAcceso} className="mb-4 flex flex-wrap items-end gap-2">
          <input className="campo w-72" type="email" required placeholder="correo@marca.com" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
          <select className="campo" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as "marca" | "admin" })}>
            <option value="marca">Usuario de marca</option>
            <option value="admin">Administrador (ve todo)</option>
          </select>
          {nuevo.rol === "marca" && (
            <select className="campo" value={nuevo.marca_id} onChange={(e) => setNuevo({ ...nuevo, marca_id: e.target.value })}>
              <option value="">Marca…</option>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          )}
          <button className="boton">Agregar</button>
        </form>
        <table className="tabla">
          <thead><tr><th>Correo</th><th>Rol</th><th>Marca</th><th>Cuenta</th><th></th></tr></thead>
          <tbody>
            {accesos.map((a) => (
              <tr key={a.email}>
                <td>{a.email}</td>
                <td>{a.rol === "admin" ? "Administrador" : "Marca"}</td>
                <td>{a.rol === "admin" ? "Todas" : marcaNombre(a.marca_id)}</td>
                <td>{activos.has(a.email) ? <span className="text-green-700">Activa</span> : <span className="text-stone-500">Pendiente de activar</span>}</td>
                <td className="text-right"><button className="text-xs text-red-700 hover:underline" onClick={() => quitarAcceso(a.email)}>Quitar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tarjeta">
        <h2 className="mb-1 font-medium">Marcas y sedes</h2>
        <p className="mb-3 text-sm text-stone-600">
          Los Excel a veces nombran la misma sede de formas distintas (ej. “ROCOTTO LAURELES” y “ROCOTO LAURELES”). Aquí puedes unir un nombre con su sede real;
          los datos ya cargados con ese nombre se mueven también. Los <b>centros de producción</b> no suman al costo de las sedes porque su costo llega como traslados.
        </p>
        <form onSubmit={crearMarca} className="mb-4 flex gap-2">
          <input className="campo" placeholder="Nueva marca" value={nuevaMarca} onChange={(e) => setNuevaMarca(e.target.value)} />
          <button className="boton-sec">Crear marca</button>
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          {marcas.map((m) => {
            const sedesM = sedes.filter((s) => s.marca_id === m.id);
            return (
              <div key={m.id} className="rounded-lg border border-stone-200 p-3">
                <h3 className="mb-2 text-sm font-semibold">{m.nombre}</h3>
                {sedesM.map((s) => (
                  <div key={s.id} className="mb-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{s.nombre}</span>
                      <select className="campo !py-0.5 !text-xs" value={s.tipo} onChange={(e) => cambiarTipo(s.id, e.target.value)}>
                        <option value="punto_venta">Punto de venta</option>
                        <option value="produccion">Centro de producción</option>
                      </select>
                    </div>
                    {alias.filter((a) => a.sede_id === s.id).map((a) => (
                      <div key={a.alias} className="ml-3 flex items-center justify-between gap-2 text-xs text-stone-500">
                        <span>“{a.alias}”</span>
                        <select className="campo !py-0 !text-xs" value={a.sede_id} onChange={(e) => reasignar(a, Number(e.target.value))}>
                          {sedesM.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
                {sedesM.length === 0 && <p className="text-xs text-stone-500">Sin sedes. Se crean solas al cargar el primer archivo.</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
