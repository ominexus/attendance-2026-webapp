import { createRoot } from "react-dom/client";
import App from "./App";
import { resetBrowserStateOnReload } from "./lib/freshVisitReset";
import "./index.css";

resetBrowserStateOnReload();

createRoot(document.getElementById("root")!).render(<App />);
