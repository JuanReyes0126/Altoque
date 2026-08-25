import { useState } from "react";
import Nav from "./components/Nav";
import Cover from "./components/Cover";
import { Veredicto, Stack } from "./components/Strategy";
import { Arquitectura, Datos } from "./components/Architecture";
import StateMachine from "./components/StateMachine";
import Prototype from "./components/Prototype";
import { Pantallas, Confianza, Crecimiento } from "./components/Systems";
import { Alcance, Plan, Aprobacion, Footer } from "./components/Roadmap";

export default function BlueprintDoc() {
  const [approved, setApproved] = useState(false);

  return (
    <div className="relative min-h-screen font-body">
      {/* barra para volver al producto */}
      <a
        href="#/"
        className="fixed top-4 left-4 z-[90] inline-flex items-center gap-2 rounded-full bg-jade text-ink font-bold text-xs px-4 py-2.5 shadow-lg hover:brightness-110 transition-all"
      >
        ← Volver a la app
      </a>

      {/* ambient layers */}
      <div className="bp-glow" aria-hidden />
      <div className="bp-grid fixed inset-0 z-0 pointer-events-none" aria-hidden />
      <div className="bp-noise" aria-hidden />

      <div className="relative z-10">
        <Nav approved={approved} />
        <main>
          <Cover />
          <Veredicto />
          <Stack />
          <Arquitectura />
          <Datos />
          <StateMachine />
          <Prototype />
          <Pantallas />
          <Confianza />
          <Crecimiento />
          <Alcance />
          <Plan />
          <Aprobacion approved={approved} onApprove={() => setApproved(true)} />
        </main>
        <Footer />
      </div>
    </div>
  );
}
