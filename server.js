const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const HARD_TIMEOUT = 60 * 60 * 1000; // 1 hour

setTimeout(() => {
    console.log("\n[AUTO-SHUTDOWN] Server has reached the 1-hour hard limit. Shutting down...\n");
    process.exit(0);
}, HARD_TIMEOUT);

app.prepare().then(() => {
    createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error("Error occurred handling", req.url, err);
            res.statusCode = 500;
            res.end("internal server error");
        }
    }).listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> Auto-shutdown enabled: Server will exit exactly 1 hour from now`);
    });
});
