const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = __dirname;
const port = Number(process.env.PORT) || 3000;

const contentTypes = {
  '.avi': 'video/x-msvideo',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jp2': 'image/jp2',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.mpg': 'video/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.webm': 'video/webm',
  '.xml': 'application/xml; charset=utf-8'
};

function getFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const relativePath = pathname === '/'
    ? 'index.html'
    : pathname.replace(/^\/+|\/+$/g, '');
  const requestedPath = path.normalize(relativePath);

  if (requestedPath.startsWith('..') || path.isAbsolute(requestedPath)) {
    return null;
  }

  const directPath = path.join(root, requestedPath);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  if (!path.extname(requestedPath)) {
    const pagePath = `${directPath}.html`;
    if (fs.existsSync(pagePath) && fs.statSync(pagePath).isFile()) {
      return pagePath;
    }
  }

  return null;
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let filePath;
  try {
    filePath = getFilePath(request.url);
  } catch (_error) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const headers = { 'Content-Type': contentTypes[extension] || 'application/octet-stream' };
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    headers['Content-Length'] = stats.size;
    response.writeHead(200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Portfolio preview available at http://localhost:${port}`);
});
