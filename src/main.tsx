import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import {localCareLab} from "./localCareGate";
import "./styles.css";
import "./panels.css";

// NOTE: StrictMode double-invokes effects in dev. The engine guards against
// double-start (see store.startEngine), so the simulation runs once.
if(localCareLab&&new URLSearchParams(location.search).get('view')==='care-lab'){
 void import('./render/CareLab').then(({default:CareLab})=>createRoot(document.getElementById('root')!).render(<CareLab/>));
}else if(new URLSearchParams(location.search).get('view')==='snake-studio'){
  void import('./render/snakeStudio').then(m=>m.showSnakeStudio(document.getElementById('root')!));
}else if(new URLSearchParams(location.search).get('view')==='mating-studio'){
  void import('./render/matingStudio').then(m=>m.showMatingStudio(document.getElementById('root')!));
}else if(new URLSearchParams(location.search).get('view')==='gait-studio'){
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
