/* eslint-disable @typescript-eslint/no-require-imports -- cPanel startup entry uses CommonJS. */
// Optional standard Node HTTP entry point for panels requiring a startup file.
// Use npm start when the host supports a start command directly.
const http = require("node:http");
const next = require("next");
const port = Number.parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false });
const handle = app.getRequestHandler();
app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, () => {
        console.log("KadiYangu server ready");
      });
  })
  .catch(() => {
    console.error("Application startup failed");
    process.exit(1);
  });
