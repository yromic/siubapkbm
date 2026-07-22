// server.js - Phusion Passenger entry point for Next.js on cPanel Shared Hosting
const path = require('path');
const fs = require('fs');

// Ensure correct production environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
const port = process.env.PORT || 3000;

// Path to standalone server created by Next.js build (output: 'standalone')
const standaloneServerPath = path.join(__dirname, '.next', 'standalone', 'server.js');

if (fs.existsSync(standaloneServerPath)) {
  // Execute Next.js standalone server
  require(standaloneServerPath);
} else {
  // Fallback custom server for direct execution
  const { createServer } = require('http');
  const next = require('next');

  const dev = process.env.NODE_ENV !== 'production';
  const app = next({ dev, dir: __dirname });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    createServer((req, res) => {
      handle(req, res);
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on port ${port}`);
    });
  });
}
