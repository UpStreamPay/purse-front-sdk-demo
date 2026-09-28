import { createRoot } from "react-dom/client";
import { t } from "../i18n";
import "../index.css";
import { SecureFieldsPage } from "./SecureFieldsPage.tsx";

document.title = t("sf.pageTitle");
createRoot(document.getElementById("root")!).render(<SecureFieldsPage />);
