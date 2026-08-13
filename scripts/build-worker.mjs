import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distServer = join(root, "dist", "server");
const files = [
  "index.html",
  "student.html",
  "teacher.html",
  "admin.html",
  "styles.css",
  "app.js",
];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

const assets = Object.fromEntries(
  files.map((file) => {
    const ext = file.slice(file.lastIndexOf("."));
    return [
      `/${file}`,
      {
        body: readFileSync(join(root, file), "utf8"),
        type: contentTypes[ext] || "text/plain; charset=utf-8",
      },
    ];
  }),
);

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(distServer, { recursive: true });

const worker = `const ASSETS = ${JSON.stringify(assets)};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const asset = ASSETS[path] || ASSETS["/index.html"];
    return new Response(asset.body, {
      headers: {
        "content-type": asset.type,
        "cache-control": "no-store",
      },
    });
  },
};
`;

writeFileSync(join(distServer, "index.js"), worker, "utf8");
