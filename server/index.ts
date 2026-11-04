import { createApp } from "./app.ts";
import { createStore } from "./store.ts";
import express from "express";
import { resolve } from "node:path";
const app = createApp(createStore(resolve(process.env.DATA_DIR || "data")));
if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  // Only known application routes get the SPA document; removed files return 404.
  app.get(["/", "/admin", "/admin/"], (_req, res) =>
    res.sendFile(resolve("dist/index.html")),
  );
  app.use((_req, res) => res.status(404).send("페이지를 찾을 수 없습니다."));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("Portfolio server ready"),
);
