export function Encabezado({ titulo, descripcion, children }: { titulo: string; descripcion?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-tinta">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-3xl text-[13px] text-texto-2">{descripcion}</p>}
      </div>
      {children}
    </div>
  );
}
