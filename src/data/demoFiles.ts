export interface DemoFile {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: DemoFile[];
  content?: string;
}

export function flattenFiles(nodes: DemoFile[]): DemoFile[] {
  return nodes.flatMap((node) => {
    const children = node.children ? flattenFiles(node.children) : [];
    return node.type === "file" ? [node, ...children] : children;
  });
}

export const demoFiles: DemoFile[] = [
  {
    name: "index.html",
    type: "file",
    path: "index.html",
    content: [
      "<!doctype html>",
      "<html lang=\"en\">",
      "  <head><title>Demo Project</title></head>",
      "  <body><div id=\"root\"></div></body>",
      "</html>",
      "",
    ].join("\n"),
  },
  {
    name: "package.json",
    type: "file",
    path: "package.json",
    content: [
      "{",
      "  \"name\": \"demo-project\",",
      "  \"version\": \"0.1.0\",",
      "  \"scripts\": { \"dev\": \"vite\" }",
      "}",
      "",
    ].join("\n"),
  },
  {
    name: "src",
    type: "folder",
    path: "src",
    children: [
      {
        name: "main.tsx",
        type: "file",
        path: "src/main.tsx",
        content: [
          "import React from \"react\";",
          "import { createRoot } from \"react-dom/client\";",
          "import App from \"./App\";",
          "",
          "createRoot(document.getElementById(\"root\")!).render(<App />);",
          "",
        ].join("\n"),
      },
      {
        name: "App.tsx",
        type: "file",
        path: "src/App.tsx",
        content: [
          "export default function App() {",
          "  return <h1>Hello, Cracker Box</h1>;",
          "}",
          "",
        ].join("\n"),
      },
      {
        name: "index.css",
        type: "file",
        path: "src/index.css",
        content: [
          ":root { color-scheme: dark; }",
          "body { margin: 0; background: #09090b; color: #fafafa; }",
          "",
        ].join("\n"),
      },
      {
        name: "components",
        type: "folder",
        path: "src/components",
        children: [
          {
            name: "Button.tsx",
            type: "file",
            path: "src/components/Button.tsx",
            content: [
              "export function Button({ label }: { label: string }) {",
              "  return <button type=\"button\">{label}</button>;",
              "}",
              "",
            ].join("\n"),
          },
          {
            name: "Card.tsx",
            type: "file",
            path: "src/components/Card.tsx",
            content: [
              "export function Card() {",
              "  return <div className=\"card\">Card</div>;",
              "}",
              "",
            ].join("\n"),
          },
        ],
      },
    ],
  },
  {
    name: "public",
    type: "folder",
    path: "public",
    children: [
      {
        name: "favicon.svg",
        type: "file",
        path: "public/favicon.svg",
        content: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"/>', ""].join("\n"),
      },
    ],
  },
  {
    name: "README.md",
    type: "file",
    path: "README.md",
    content: ["# Demo project", "", "A small sample tree for the Cracker Box file navigator.", ""].join("\n"),
  },
];
