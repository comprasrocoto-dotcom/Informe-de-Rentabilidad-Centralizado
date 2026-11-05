"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/Contexto";

type Acceso = { email: string; rol: "admin" | "marca"; marcas: number[] };
type PerfilFila = { email: string; created_at: string };
type Alias = { marca_id: number; alias: string; sede_id: number };

export default function Admin() {
  const { sb, perfil, marcas, sedes, recargarCatalogos } = useApp();
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [activos, setActivos] = useState<Map<string, string>>(new Map());
  const [alias, setAlias] = useState<Alias[]>([]);
  const [nuevo, setNuevo] = useState<{ email: string; marcas: number[]; rol: "marca" | "admin" }>({ email: "", marcas: [], rol: "marca" });
  const [nuevaMarca, setNuevaMarca] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function cargar() {
    const [a, am, p, al] = await Promise.all([
      sb.from("accesos").select("email,rol").order("email"),
      sb.from("accesos_marcas").select("email,marca_id"),
      sb.from("perfiles").select("email,created_at"),
      sb.from("sede_alias").select("marca_id,alias,sede_id").order("alias"),
    ]);
    const porEmail = new Map<string, number[]>();
    for (const x of (am.data as { email: string; marca_id: number }[]) ?? []) {
      porEmail.set(x.email, [...(porEmail.get(x.email) ?? []), x.marca_id]);
    }
    setAccesos(((a.data as { email: string; rol: Acceso["rol"] }[]) ?? []).map((x) => ({ ...x, marcas: porEmail.get(x.email) ?? [] })));
    setActivos(new Map(((p.data as PerfilFila[]) ?? []).map((x) => [x.email, x.created_at])));
    setAlias((al.data as Alias[]) ?? []);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);

  if (perfil.rol !== "admin") return <p className="text-sm text-texto-2">Esta sección es solo para el administrador.</p>;

  const avisar = (ok: boolean, texto: string) => setMsg({ ok, texto });
  const marcaNombre = (id: number | null) => marcas.find((m) => m.id === id)?.nombre ?? "—";
  const alternarMarca = (id: number) =>
    setNuevo((n) => ({ ...n, marcas: n.marcas.includes(id) ? n.marcas.filter((x) => x !== id) : [...n.marcas, id] }));

  async function agregarAcceso(e: React.FormEvent) {
    e.preventDefault();
    const email = nuevo.email.trim().toLowerCase();
    if (nuevo.rol === "marca" && nuevo.marcas.length === 0) return avisar(false, "Elige al menos una marca para el correo.");
    const { error } = await sb.from("accesos").upsert({ email, rol: nuevo.rol });
    if (error) return avisar(false, error.message);
    // Reemplazar las marcas del correo por las elegidas
    const { error: e1 } = await sb.from("accesos_marcas").delete().eq("email", email);
    if (e1) return avisar(false, e1.message);
    if (nuevo.rol === "marca") {
      const { error: e2 } = await sb.from("accesos_marcas").insert(nuevo.marcas.map((marca_id) => ({ email, marca_id })));
      if (e2) return avisar(false, e2.message);
    }
    setNuevo({ email: "", marcas: [], rol: "marca" });
    avisar(true, `Listo. ${email} puede entrar a la página; si aún no tiene cuenta, usa “Activar cuenta” para crear su clave.`);
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

  async function guardarMeta(id: number, pct: number) {
    if (!(pct > 0 && pct < 100)) return avisar(false, "La meta debe estar entre 1 y 99 %.");
    const { error } = await sb.from("marcas").update({ meta_costo: pct / 100 }).eq("id", id);
    if (error) return avisar(false, error.message);
    avisar(true, `Meta de costo de ${marcas.find((m) => m.id === id)?.nombre} guardada en ${pct}%.`);
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
      <h1 className="text-[22px] font-semibold tracking-tight text-tinta">Administración</h1>
      {msg && <p className={`rounded-md p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.texto}</p>}

      <section className="tarjeta">
        <h2 className="mb-1 font-medium">Correos con acceso</h2>
        <p className="mb-3 text-sm text-texto-2">
          Registra aquí cada correo y marca las marcas que puede ver (puede ser más de una). Luego esa persona entra a la página, elige <b>“Activar cuenta”</b> y crea su propia clave
          (le llega un correo para confirmar). Cada marca solo ve sus datos.
        </p>
        <form onSubmit={agregarAcceso} className="mb-4 flex flex-wrap items-end gap-2">
          <input className="campo w-72" type="email" required placeholder="correo@marca.com" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
          <select className="campo" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as "marca" | "admin" })}>
            <option value="marca">Usuario de marca</option>
            <option value="admin">Administrador (ve todo)</option>
          </select>
          {nuevo.rol === "marca" && (
            <div className="flex flex-wrap gap-2">
              {marcas.map((m) => (
                <label key={m.id} className="flex items-center gap-1 rounded-md border border-linea px-2 py-1 text-sm">
                  <input type="checkbox" checked={nuevo.marcas.includes(m.id)} onChange={() => alternarMarca(m.id)} /> {m.nombre}
                </label>
              ))}
            </div>
          )}
          <button className="boton">Guardar</button>
        </form>
        <table className="tabla">
          <thead><tr><th>Correo</th><th>Rol</th><th>Marca</th><th>Cuenta</th><th></th></tr></thead>
          <tbody>
            {accesos.map((a) => (
              <tr key={a.email}>
                <td>{a.email}</td>
                <td>{a.rol === "admin" ? "Administrador" : "Marca"}</td>
                <td>{a.rol === "admin" ? "Todas" : a.marcas.map(marcaNombre).sort().join(", ") || "—"}</td>
                <td>{activos.has(a.email) ? <span className="text-green-700">Activa</span> : <span className="text-texto-2">Pendiente de activar</span>}</td>
                <td className="whitespace-nowrap text-right">
                  <button className="mr-3 text-xs text-marca hover:underline" onClick={() => setNuevo({ email: a.email, rol: a.rol, marcas: a.marcas })}>Editar</button>
                  <button className="text-xs text-red-700 hover:underline" onClick={() => quitarAcceso(a.email)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="tarjeta">
        <h2 className="mb-1 font-medium">Marcas y sedes</h2>
        <p className="mb-3 text-sm text-texto-2">
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
              <div key={m.id} className="rounded-lg border border-linea p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{m.nombre}</h3>
                  <label className="flex items-center gap-1 text-xs text-texto-2" title="Meta de costo de mercancía vendida: por encima se marca en rojo">
                    Meta de costo
                    <input
                      type="number" min={1} max={99} step={0.5} className="campo !h-7 w-16 !px-1.5 text-right"
                      defaultValue={Math.round(Number(m.meta_costo ?? 0.35) * 1000) / 10}
                      onBlur={(e) => guardarMeta(m.id, Number(e.target.value))}
                    />%
                  </label>
                </div>
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
                      <div key={a.alias} className="ml-3 flex items-center justify-between gap-2 text-xs text-texto-2">
                        <span>“{a.alias}”</span>
                        <select className="campo !py-0 !text-xs" value={a.sede_id} onChange={(e) => reasignar(a, Number(e.target.value))}>
                          {sedesM.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
                {sedesM.length === 0 && <p className="text-xs text-texto-2">Sin sedes. Se crean solas al cargar el primer archivo.</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
