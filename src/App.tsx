import { useState } from "react";
import Nav from "./components/Nav";
import Cover from "./components/Cover";
import { Veredicto, Stack } from "./components/Strategy";
import { Arquitectura, Datos } from "./components/Architecture";
import StateMachine from "./components/StateMachine";
import Prototype from "./components/Prototype";
import { Pantallas, Confianza, Crecimiento } from "./components/Systems";
import { Alcance, Plan, Aprobacion, Footer } from "./components/Roadmap";

export default function App() {
  const [approved, setApproved] = useState(false);

  return (
    <div className="relative min-h-screen font-body">
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
