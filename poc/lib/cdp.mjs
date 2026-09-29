import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';

import { analyserProbe, applySurface, menuProbe, readSurface, removeSurface } from './page.mjs';
import { auditExpression, pickPageTarget } from './plan.mjs';
import { decodeFrames, encodeTextFrame } from './ws.mjs';

const ALLOWED = new Set([
  'Runtime.enable',
  'Runtime.evaluate',
  'Runtime.callFunctionOn',
  'Runtime.queryObjects',
  'Runtime.releaseObject',
]);

export function fetchLoopbackJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: '127.0.0.1', port, path: pathname, timeout: 3000 },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

export function connectCdp(wsUrl) {
  const url = new URL(wsUrl);
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    return Promise.reject(new Error('CDP host is not loopback'));
  }
  const port = Number(url.port);
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const key = crypto.randomBytes(16).toString('base64');
    const path = `${url.pathname}${url.search}`;
    socket.write([
      `GET ${path} HTTP/1.1`,
      `Host: 127.0.0.1:${port}`,
      `Origin: http://127.0.0.1:${port}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      '',
      '',
    ].join('\r\n'));

    let buffer = Buffer.alloc(0);
    let established = false;
    const pending = new Map();
    let nextId = 0;
    const fail = (error) => {
      socket.destroy();
      reject(error);
    };
    const session = {
      send(method, params = {}) {
        if (!ALLOWED.has(method)) return Promise.reject(new Error(`method blocked: ${method}`));
        if (method === 'Runtime.evaluate' || method === 'Runtime.callFunctionOn') {
          const source = params.expression || params.functionDeclaration || '';
          const banned = auditExpression(source);
          if (banned) return Promise.reject(new Error(`expression blocked: ${banned}`));
        }
        const id = ++nextId;
        socket.write(encodeTextFrame(JSON.stringify({ id, method, params })));
        return new Promise((res, rej) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            rej(new Error(`timeout ${method}`));
          }, 15000);
          pending.set(id, { res, rej, timer });
        });
      },
      close() {
        socket.end();
      },
    };

    socket.on('error', (error) => {
      if (!established) fail(error);
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!established) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end === -1) return;
        const header = buffer.subarray(0, end).toString('utf8');
        buffer = buffer.subarray(end + 4);
        if (!header.startsWith('HTTP/1.1 101')) {
          fail(new Error('websocket upgrade failed'));
          return;
        }
        established = true;
        resolve(session);
      }
      const decoded = decodeFrames(buffer);
      buffer = Buffer.from(decoded.rest);
      for (const message of decoded.messages) {
        let parsed;
        try {
          parsed = JSON.parse(message);
        } catch {
          continue;
        }
        const waiter = pending.get(parsed.id);
        if (!waiter) continue;
        pending.delete(parsed.id);
        clearTimeout(waiter.timer);
        if (parsed.error) waiter.rej(new Error(parsed.error.message || 'cdp error'));
        else waiter.res(parsed.result);
      }
    });
  });
}

export async function inspectPage({ port, apply }) {
  const list = await fetchLoopbackJson(port, '/json/list');
  const picked = pickPageTarget(list);
  if (!picked.webSocketDebuggerUrl) {
    return {
      pageFound: false,
      background: null,
      buttonBackground: null,
      buttonFound: false,
      stylePresent: false,
      heldInSession: false,
      analyser: null,
      menu: null,
    };
  }
  const cdp = await connectCdp(picked.webSocketDebuggerUrl);
  try {
    await cdp.send('Runtime.enable');
    if (!apply) {
      const surface = await evaluate(cdp, documentCall(readSurface));
      return {
        pageFound: true,
        background: surface?.background || null,
        buttonBackground: surface?.buttonBackground || null,
        buttonFound: Boolean(surface?.buttonFound),
        buttonTestId: safeTestId(surface?.buttonTestId),
        stylePresent: Boolean(surface?.stylePresent),
        heldInSession: false,
        analyser: null,
        menu: null,
      };
    }
    await evaluate(cdp, documentCall(applySurface));
    await delay(1500);
    const surface = await evaluate(cdp, documentCall(readSurface));
    const audio = await evaluate(cdp, `(${analyserProbe.toString()})(globalThis)`);
    const menu = await evaluate(cdp, documentCall(menuProbe));
    return {
      pageFound: true,
      background: surface?.background || null,
      buttonBackground: surface?.buttonBackground || null,
      buttonFound: Boolean(surface?.buttonFound),
      buttonTestId: safeTestId(surface?.buttonTestId),
      stylePresent: Boolean(surface?.stylePresent),
      heldInSession: Boolean(surface?.stylePresent),
      analyser: {
        hasAudioContextCtor: Boolean(audio?.hasAudioContextCtor),
        hasAnalyserNode: Boolean(audio?.hasAnalyserNode),
        liveContexts: await countAudioContexts(cdp),
        spectrumRead: false,
      },
      menu,
    };
  } finally {
    cdp.close();
  }
}

export async function restoreSurface(port) {
  const list = await fetchLoopbackJson(port, '/json/list');
  const picked = pickPageTarget(list);
  if (!picked.webSocketDebuggerUrl) return false;
  const cdp = await connectCdp(picked.webSocketDebuggerUrl);
  try {
    await cdp.send('Runtime.enable');
    const removed = await evaluate(cdp, `(${removeSurfaceSource()})(document)`);
    return Boolean(removed);
  } finally {
    cdp.close();
  }
}

function documentCall(fn) {
  return `(${fn.toString()})(document, getComputedStyle)`;
}

function removeSurfaceSource() {
  return removeSurface.toString();
}

async function evaluate(cdp, expression) {
  const banned = auditExpression(expression);
  if (banned) throw new Error(`expression blocked: ${banned}`);
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  if (response.exceptionDetails) throw new Error('page expression failed');
  return response.result?.value;
}

async function countAudioContexts(cdp) {
  let protoId = null;
  let objectsId = null;
  try {
    const response = await cdp.send('Runtime.evaluate', {
      expression: 'globalThis.AudioContext && globalThis.AudioContext.prototype',
      returnByValue: false,
    });
    protoId = response.result?.objectId || null;
    if (!protoId) return null;
    const queried = await cdp.send('Runtime.queryObjects', { prototypeObjectId: protoId });
    objectsId = queried.objects?.objectId || null;
    if (!objectsId) return null;
    const length = await cdp.send('Runtime.callFunctionOn', {
      objectId: objectsId,
      functionDeclaration: 'function () { return this.length; }',
      returnByValue: true,
    });
    return typeof length.result?.value === 'number' ? length.result.value : null;
  } catch {
    return null;
  } finally {
    if (protoId) await cdp.send('Runtime.releaseObject', { objectId: protoId }).catch(() => {});
    if (objectsId) await cdp.send('Runtime.releaseObject', { objectId: objectsId }).catch(() => {});
  }
}

function safeTestId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test(value)) return null;
  return value;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
