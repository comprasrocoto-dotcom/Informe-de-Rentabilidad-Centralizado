import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ProveedorApp, type Perfil } from "@/components/Contexto";
import { Menu } from "@/components/Menu";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const supabase = await crearClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("email, rol, marca_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!perfil || (perfil.rol !== "admin" && !perfil.marca_id)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="tarjeta max-w-md text-sm">
          <h1 className="mb-2 text-lg font-semibold">Tu cuenta no tiene una marca asignada</h1>
          <p className="text-stone-600">
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
    <ProveedorApp perfil={perfil as Perfil}>
      <Menu />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </ProveedorApp>
  );
}
