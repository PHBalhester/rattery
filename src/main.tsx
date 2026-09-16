import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./panels.css";

// NOTE: StrictMode double-invokes effects in dev. The engine guards against
// double-start (see store.startEngine), so the simulation runs once.
if(new URLSearchParams(location.search).get('view')==='gait-studio'){
  void import('./render/gaitStudio').then(m=>m.showGaitStudio(document.getElementById('root')!));
}else if(new URLSearchParams(location.search).get('view')==='wheel-studio'){
  void import('./render/wheelStudio').then(m=>m.showWheelStudio(document.getElementById('root')!));
}else if(new URLSearchParams(location.search).get('view')==='rat-studio'){
  void import('./render/ratStudio').then(m=>m.showRatStudio(document.getElementById('root')!));
}else createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
