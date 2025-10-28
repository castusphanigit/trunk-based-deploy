/**
 * Module dependencies.
 */
import debug from "debug";
import http from "http";
import { initializeAppWithErrorHandling } from "../config/app.initializer";

const debugServer = debug("express-typescript:server");

/**
 * Initialize and start the server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize app with secrets loading first
    await initializeAppWithErrorHandling();
    
    // Import app after initialization
    const { default: app } = await import("../../app");
    
    /**
     * Get port from environment and store in Express.
     */
    // eslint-disable-next-line n/no-process-env
    const port = normalizePort(process.env.PORT ?? "3000");
    app.set("port", port);

    /**
     * Create HTTP server.
     */
    const server = http.createServer(app);

    /**
     * Listen on provided port, on all network interfaces.
     */
    // eslint-disable-next-line no-console
    console.log(`Server is running on:${port}`);

    server.listen(port);
    server.on("error", (error) => onError(error, port));
    server.on("listening", () => onListening(server));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server:", error);
    throw error;
  }
}

// Start the server
startServer();

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val: string): number | string | false {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: NodeJS.ErrnoException, port: number | string | false): void {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      // eslint-disable-next-line no-console
      console.error(bind + " requires elevated privileges");
      throw new Error(bind + " requires elevated privileges");
    case "EADDRINUSE":
      // eslint-disable-next-line no-console
      console.error(bind + " is already in use");
      throw new Error(bind + " is already in use");
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening(server: http.Server): void {
  const addr = server.address();
  if (typeof addr === "string") {
    debugServer("Listening on pipe " + addr);
  } else if (addr && typeof addr === "object") {
    const port = addr.port ? String(addr.port) : "unknown";
    debugServer("Listening on port " + port);
  } else {
    debugServer("Listening on unknown address");
  }
}
