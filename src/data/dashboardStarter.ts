import type { DemoFile } from "./demoFiles";
import indexHtml from "./dashboardStarter/index.html?raw";
import styleCss from "./dashboardStarter/style.css?raw";
import appJs from "./dashboardStarter/app.js?raw";

export const DASHBOARD_STARTER_NAME = "Dashboard";

export const dashboardStarterFiles: DemoFile[] = [
  { name: "index.html", type: "file", path: "index.html", content: indexHtml },
  { name: "style.css", type: "file", path: "style.css", content: styleCss },
  { name: "app.js", type: "file", path: "app.js", content: appJs },
];
