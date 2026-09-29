import { createRoot } from "react-dom/client";
import { t } from "./i18n";
import "./index.css";
import { Landing } from "./Landing.tsx";

document.title = t("landing.title");
createRoot(document.getElementById("root")!).render(<Landing />);
