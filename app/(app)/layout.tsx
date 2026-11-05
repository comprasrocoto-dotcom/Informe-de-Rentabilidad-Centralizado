import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ProveedorApp, type Perfil } from "@/components/Contexto";
import { Menu } from "@/components/Menu";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const supabase = await crearClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: fila } = await supabase
    .from("perfiles")
    .select("email, rol")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const { data: am } = fila
    ? await supabase.from("accesos_marcas").select("marca_id").eq("email", fila.email)
    : { data: [] };
  const perfil: Perfil | null = fila
    ? { email: fila.email, rol: fila.rol, marcas: (am ?? []).map((x) => x.marca_id as number) }
    : null;

  if (!perfil || (perfil.rol !== "admin" && perfil.marcas.length === 0)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="tarjeta max-w-md text-sm">
          <h1 className="mb-2 text-lg font-semibold">Tu cuenta no tiene una marca asignada</h1>
          <p className="text-texto-2">
            Ingresaste como <b>{auth.user.email}</b>, pero este correo no está asociado a ninguna marca.
            Pídele al administrador que lo registre.
          </p>
          <form action="/auth/salir" method="post" className="mt-4">
            <button className="boton-sec">Salir</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <ProveedorApp perfil={perfil}>
      <Menu />
      <main className="ml-14 min-w-0 px-4 pt-[52px] pb-8 lg:px-8 lg:pt-[60px]">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </ProveedorApp>
  );
}
