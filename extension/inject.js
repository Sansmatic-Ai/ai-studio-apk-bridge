/*! AI Studio APK Bridge v1.0.0 | Copyright (c) 2026 Tamal Mitra | MIT License (see LICENSE in the repository root) */
/*
 * AI Studio APK Bridge  -  runs inside the AI Studio page (MAIN world).
 * 1. Replaces navigator.usb with a virtual "Android phone" that speaks ADB.
 * 2. AI Studio pushes the built APK to that virtual phone (like it would over USB).
 * 3. We collect the bytes, build a real .apk file, and show a Download button.
 * 4. Extra safety nets: also catches APK blobs / fetches that look like an APK.
 */
(function () {
  'use strict';
  if (window.__apkBridgeLoaded) return;
  window.__apkBridgeLoaded = true;
  try { document.documentElement.setAttribute('data-apk-bridge', '1'); } catch (e) {}
  var IS_TOP = window.top === window;
  var MAX_DATA = 256 * 1024;
  var enc = new TextEncoder();
  var dec = new TextDecoder();
  var EMPTY = new Uint8Array(0);

  /* ------------------------------------------------------------------ */
  /* Logging                                                             */
  /* ------------------------------------------------------------------ */
  var logs = [];
  var ui = {};
  function str(x) {
    if (typeof x === 'string') return x;
    try { return JSON.stringify(x); } catch (e) { return String(x); }
  }
  function log() {
    var args = Array.prototype.slice.call(arguments);
    var line = new Date().toISOString().slice(11, 23) + ' ' + args.map(str).join(' ');
    logs.push(line);
    if (logs.length > 1000) logs.shift();
    try { console.log.apply(console, ['[APK Bridge]'].concat(args)); } catch (e) {}
    if (ui.refreshLogs) ui.refreshLogs();
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  function concat(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }
  function joinParts(parts) {
    if (parts.length === 1) return parts[0];
    var total = 0, i;
    for (i = 0; i < parts.length; i++) total += parts[i].length;
    var out = new Uint8Array(total), off = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], off); off += parts[i].length; }
    return out;
  }
  function toBytes(data) {
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
    }
    return new Uint8Array(data).slice();
  }
  function cstr(bytes) {
    var s = dec.decode(bytes);
    var z = s.indexOf('\0');
    return z >= 0 ? s.slice(0, z) : s;
  }
  function fmtSize(n) {
    if (n > 1048576) return (n / 1048576).toFixed(2) + ' MB';
    if (n > 1024) return (n / 1024).toFixed(1) + ' KB';
    return n + ' B';
  }
  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /* ------------------------------------------------------------------ */
  /* Captured APKs                                                       */
  /* ------------------------------------------------------------------ */
  var captured = [];
  var seenChunkSets = [];
  var seenBlobs = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  var origCreateObjectURL = URL.createObjectURL.bind(URL);

  function looksLikeZip(first) {
    return first && first.length > 3 && first[0] === 0x50 && first[1] === 0x4b;
  }
  function registerBlob(blob, source, originalName) {
    if (seenBlobs) seenBlobs.add(blob);
    var n = captured.length + 1;
    var item = {
      id: n,
      name: 'ai-studio-app-' + stamp() + (n > 1 ? '-' + n : '') + '.apk',
      size: blob.size,
      source: source,
      originalName: originalName || '',
      url: origCreateObjectURL(blob),
      blob: blob
    };
    captured.push(item);
    log('APK captured (' + source + '):', item.name, fmtSize(item.size), originalName ? '[' + originalName + ']' : '');
    if (ui.onCapture) ui.onCapture(item);
    return item;
  }
  function registerApk(name, chunks, source) {
    if (seenChunkSets.indexOf(chunks) !== -1) return;
    seenChunkSets.push(chunks);
    var size = 0, i;
    for (i = 0; i < chunks.length; i++) size += chunks[i].length;
    if (!size) { log('Ignoring empty file', name); return; }
    if (!looksLikeZip(chunks[0])) log('WARNING: data does not start with "PK" - may not be an APK:', name);
    var blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
    registerBlob(blob, source || 'adb', name);
  }
  function downloadItem(item) {
    try {
      var a = document.createElement('a');
      a.href = item.url;
      a.download = item.name;
      a.style.display = 'none';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); }, 1500);
      log('Download started:', item.name);
    } catch (e) {
      log('Download failed:', String(e));
    }
  }

  /* ------------------------------------------------------------------ */
  /* ADB packets                                                         */
  /* ------------------------------------------------------------------ */
  var CMD = { CNXN: 0x4e584e43, AUTH: 0x48545541, OPEN: 0x4e45504f, OKAY: 0x59414b4f, CLSE: 0x45534c43, WRTE: 0x45545257 };
  function cmdName(v) {
    for (var k in CMD) if (CMD[k] === v) return k;
    return '0x' + v.toString(16);
  }
  function makePacket(cmd, arg0, arg1, payload) {
    payload = payload || EMPTY;
    var h = new DataView(new ArrayBuffer(24));
    h.setUint32(0, cmd >>> 0, true);
    h.setUint32(4, arg0 >>> 0, true);
    h.setUint32(8, arg1 >>> 0, true);
    h.setUint32(12, payload.length, true);
    var sum = 0;
    for (var i = 0; i < payload.length; i++) sum = (sum + payload[i]) >>> 0;
    h.setUint32(16, sum, true);
    h.setUint32(20, (cmd ^ 0xffffffff) >>> 0, true);
    return payload.length ? [new Uint8Array(h.buffer), payload] : [new Uint8Array(h.buffer)];
  }

  var BANNER =
    'device::ro.product.name=apkbridge;ro.product.model=APK Bridge Phone;ro.product.device=apkbridge;' +
    'features=cmd';

  var PROPS = {
    'ro.build.version.sdk': '34',
    'ro.build.version.release': '14',
    'ro.build.version.codename': 'REL',
    'ro.product.model': 'APK Bridge Phone',
    'ro.product.manufacturer': 'Google',
    'ro.product.brand': 'google',
    'ro.product.device': 'apkbridge',
    'ro.product.cpu.abi': 'arm64-v8a',
    'ro.product.cpu.abilist': 'arm64-v8a,armeabi-v7a,armeabi',
    'ro.product.cpu.abilist64': 'arm64-v8a',
    'ro.product.cpu.abilist32': 'armeabi-v7a,armeabi'
  };

  function dirMode(path) {
    return /^\/(data(\/local(\/tmp)?)?|sdcard|storage|system|tmp)?\/?$/.test(path) ? 0x41ed : 0;
  }

  /* ------------------------------------------------------------------ */
  /* Virtual ADB daemon                                                  */
  /* ------------------------------------------------------------------ */
  function VirtualAdb() {
    this.reset();
  }
  VirtualAdb.prototype.reset = function () {
    this.rx = [];
    this.waiters = [];
    this.carry = EMPTY;
    this.cur = null;
    this.streams = {};
    this.nextStream = 1;
    this.sessions = {};
    this.nextSession = 1000 + Math.floor(Math.random() * 9000);
    this.files = {};
    this.connected = false;
    this.bytesIn = 0;
  };

  VirtualAdb.prototype.push = function (chunks) {
    for (var i = 0; i < chunks.length; i++) if (chunks[i].length) this.rx.push(chunks[i]);
    this.flush();
  };
  VirtualAdb.prototype.flush = function () {
    while (this.waiters.length && this.rx.length) {
      var w = this.waiters.shift();
      w.resolve(this.take(w.length));
    }
  };
  VirtualAdb.prototype.take = function (len) {
    var c = this.rx[0];
    if (c.length <= len) { this.rx.shift(); return c; }
    this.rx[0] = c.subarray(len);
    return c.subarray(0, len);
  };
  VirtualAdb.prototype.read = function (length) {
    var self = this;
    return new Promise(function (resolve, reject) {
      self.waiters.push({ resolve: resolve, reject: reject, length: length });
      self.flush();
    });
  };
  VirtualAdb.prototype.abortReaders = function () {
    var w = this.waiters;
    this.waiters = [];
    for (var i = 0; i < w.length; i++) {
      try { w[i].reject(new DOMException('Device closed', 'NetworkError')); } catch (e) {}
    }
  };
  VirtualAdb.prototype.send = function (cmd, a0, a1, payload) {
    this.push(makePacket(cmd, a0, a1, payload));
  };

  VirtualAdb.prototype.write = function (bytes) {
    var buf = this.carry.length ? concat(this.carry, bytes) : bytes;
    this.carry = EMPTY;
    var off = 0;
    while (true) {
      if (!this.cur) {
        if (buf.length - off < 24) break;
        var dv = new DataView(buf.buffer, buf.byteOffset + off, 24);
        this.cur = {
          cmd: dv.getUint32(0, true),
          a0: dv.getUint32(4, true),
          a1: dv.getUint32(8, true),
          len: dv.getUint32(12, true),
          parts: [],
          got: 0
        };
        off += 24;
        if (this.cur.len === 0) {
          var p0 = this.cur;
          this.cur = null;
          p0.payload = EMPTY;
          this.handle(p0);
          continue;
        }
      }
      var need = this.cur.len - this.cur.got;
      var take = Math.min(need, buf.length - off);
      if (take <= 0) break;
      this.cur.parts.push(buf.subarray(off, off + take));
      this.cur.got += take;
      off += take;
      if (this.cur.got === this.cur.len) {
        var p = this.cur;
        this.cur = null;
        p.payload = joinParts(p.parts);
        this.handle(p);
      } else {
        break;
      }
    }
    if (off < buf.length) this.carry = buf.slice(off);
  };

  VirtualAdb.prototype.handle = function (p) {
    try {
      switch (p.cmd) {
        case CMD.CNXN:
          log('HOST -> CNXN', cstr(p.payload));
          this.connected = true;
          this.send(CMD.CNXN, 0x01000001, MAX_DATA, enc.encode(BANNER + '\0'));
          if (ui.setStatus) ui.setStatus('Virtual phone connected', '#4ade80');
          break;
        case CMD.AUTH:
          log('HOST -> AUTH (accepting)');
          this.send(CMD.CNXN, 0x01000001, MAX_DATA, enc.encode(BANNER + '\0'));
          break;
        case CMD.OPEN:
          this.openStream(p);
          break;
        case CMD.WRTE:
          this.streamData(p);
          break;
        case CMD.CLSE:
          this.streamClose(p);
          break;
        case CMD.OKAY:
          break;
        default:
          log('HOST -> unknown packet', cmdName(p.cmd));
      }
    } catch (e) {
      log('ERROR handling packet', cmdName(p.cmd), String(e && e.stack || e));
    }
  };

  VirtualAdb.prototype.finish = function (st, text) {
    if (st.closed) return;
    st.closed = true;
    if (text) {
      var bytes = typeof text === 'string' ? enc.encode(text) : text;
      for (var off = 0; off < bytes.length; off += MAX_DATA) {
        this.send(CMD.WRTE, st.id, st.hostId, bytes.subarray(off, off + MAX_DATA));
      }
    }
    this.send(CMD.CLSE, st.id, st.hostId);
    delete this.streams[st.id];
  };

  VirtualAdb.prototype.openStream = function (p) {
    var service = cstr(p.payload);
    var hostId = p.a0;
    log('HOST -> OPEN', JSON.stringify(service));
    var st = {
      id: this.nextStream++,
      hostId: hostId,
      service: service,
      kind: '',
      closed: false,
      bytes: 0,
      chunks: [],
      expected: 0,
      carry: EMPTY,
      mode: 'hdr'
    };
    var m = /^(shell|exec)(?:,[^:]*)?:(.*)$/s.exec(service);
    var abb = /^abb(?:_exec)?:(.*)$/s.exec(service);
    if (/^sync:/.test(service)) {
      st.kind = 'sync';
    } else if (m) {
      st.kind = 'cmd';
      st.command = m[2];
    } else if (abb) {
      st.kind = 'cmd';
      st.command = 'package ' + abb[1].split('\0').filter(Boolean).join(' ').replace(/^package\s+/, '');
    } else {
      log('Unsupported service, rejecting:', service);
      this.send(CMD.CLSE, 0, hostId);
      return;
    }
    this.streams[st.id] = st;
    this.send(CMD.OKAY, st.id, hostId);
    if (st.kind === 'cmd') this.runCommand(st);
  };

  VirtualAdb.prototype.streamData = function (p) {
    var st = this.streams[p.a1];
    if (!st) { log('WRTE to unknown stream', p.a1); return; }
    this.send(CMD.OKAY, st.id, st.hostId);
    var data = p.payload;
    this.bytesIn += data.length;
    if (st.kind === 'sync') {
      this.syncFeed(st, data);
    } else if (st.mode === 'collect') {
      st.chunks.push(data);
      var before = st.bytes;
      st.bytes += data.length;
      if (Math.floor(st.bytes / 2097152) > Math.floor(before / 2097152)) {
        log('Receiving APK data...', fmtSize(st.bytes) + (st.expected ? ' / ' + fmtSize(st.expected) : ''));
      }
      if (ui.setStatus) ui.setStatus('Receiving APK: ' + fmtSize(st.bytes) + (st.expected ? ' / ' + fmtSize(st.expected) : ''), '#60a5fa');
      if (st.expected && st.bytes >= st.expected) this.collectDone(st, true);
    } else {
      log('Ignoring stdin data on', st.service, data.length + ' bytes');
    }
  };

  VirtualAdb.prototype.streamClose = function (p) {
    var st = this.streams[p.a1] || this.streams[p.a0];
    if (!st) return;
    log('HOST -> CLSE stream', st.id);
    if (st.mode === 'collect' && !st.collected && st.bytes > 0) this.collectDone(st, false);
    if (!st.closed) {
      st.closed = true;
      this.send(CMD.CLSE, st.id, st.hostId);
      delete this.streams[st.id];
    }
  };

  VirtualAdb.prototype.runCommand = function (st) {
    var c = (st.command || '').trim();
    var pm = /^(?:cmd\s+package|pm|package)\s+([\s\S]*)$/.exec(c);
    var sizeMatch;
    if (pm) {
      var sub = pm[1].trim();
      var tokens = sub.split(/\s+/);
      var verb = tokens[0];
      sizeMatch = /(?:^|\s)-S\s+(\d+)/.exec(sub);
      var size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
      if (verb === 'install-create') {
        var id = this.nextSession++;
        this.sessions[id] = { parts: [], size: size };
        log('PM install-create -> session', id, size ? '(' + fmtSize(size) + ')' : '');
        return this.finish(st, 'Success: created install session [' + id + ']\n');
      }
      if (verb === 'install-write') {
        var args = tokens.slice(1);
        var clean = [];
        for (var i = 0; i < args.length; i++) {
          if (args[i] === '-S') { i++; continue; }
          if (args[i].charAt(0) === '-' && args[i].length > 1) continue;
          clean.push(args[i]);
        }
        st.mode = 'collect';
        st.expected = size;
        st.session = clean[0];
        st.partName = clean[1] || 'base.apk';
        log('PM install-write: session', st.session, 'name', st.partName, size ? fmtSize(size) : '(size unknown)');
        if (ui.setStatus) ui.setStatus('Receiving APK...', '#60a5fa');
        return;
      }
      if (verb === 'install-commit') {
        var sid = tokens[tokens.length - 1];
        var sess = this.sessions[sid];
        if (sess) {
          for (var k = 0; k < sess.parts.length; k++) {
            registerApk(sess.parts[k].name, sess.parts[k].chunks, 'adb-session');
          }
          delete this.sessions[sid];
        } else {
          log('install-commit for unknown session', sid);
        }
        return this.finish(st, 'Success\n');
      }
      if (verb === 'install-abandon') return this.finish(st, 'Success\n');
      if (verb === 'install' || verb === 'install-streaming') {
        var last = tokens[tokens.length - 1];
        if (sizeMatch) {
          st.mode = 'collect';
          st.expected = size;
          st.partName = 'base.apk';
          st.single = true;
          log('PM streamed install', fmtSize(size));
          if (ui.setStatus) ui.setStatus('Receiving APK...', '#60a5fa');
          return;
        }
        if (last && last.charAt(0) === '/') {
          var f = this.files[last];
          if (f) registerApk(last.split('/').pop(), f.chunks, 'adb-sync');
          else log('pm install of unknown path', last);
        }
        return this.finish(st, 'Success\n');
      }
      if (verb === 'uninstall') return this.finish(st, 'Success\n');
      if (verb === 'list' || verb === 'path' || verb === 'resolve-activity') return this.finish(st, '');
      log('Unhandled package command:', sub);
      return this.finish(st, '');
    }
    var gp = /^getprop(?:\s+(\S+))?/.exec(c);
    if (gp) {
      if (gp[1]) return this.finish(st, (PROPS[gp[1]] || '') + '\n');
      var all = '';
      for (var key in PROPS) all += '[' + key + ']: [' + PROPS[key] + ']\n';
      return this.finish(st, all);
    }
    if (/^monkey\b/.test(c)) return this.finish(st, 'Events injected: 1\n');
    if (/^am\s+start\b/.test(c)) return this.finish(st, 'Starting: Intent { }\n');
    if (/^echo\b/.test(c)) return this.finish(st, c.replace(/^echo\s*/, '') + '\n');
    if (/^id\b/.test(c)) return this.finish(st, 'uid=2000(shell) gid=2000(shell)\n');
    if (/^(rm|mkdir|chmod|touch|sync)\b/.test(c)) return this.finish(st, '');
    log('Unhandled shell command (answering empty):', c);
    return this.finish(st, '');
  };

  VirtualAdb.prototype.collectDone = function (st, replyNow) {
    if (st.collected) return;
    st.collected = true;
    log('APK stream finished:', fmtSize(st.bytes), 'in stream', st.id);
    if (st.single) {
      registerApk(st.partName, st.chunks, 'adb-stream');
      if (replyNow) this.finish(st, 'Success\n');
    } else {
      var sess = this.sessions[st.session];
      if (sess) sess.parts.push({ name: st.partName, chunks: st.chunks });
      else registerApk(st.partName, st.chunks, 'adb-stream');
      if (replyNow) this.finish(st, 'Success: streamed ' + st.bytes + ' bytes\n');
    }
  };

  VirtualAdb.prototype.syncReply = function (st, parts) {
    var bytes = joinParts(parts);
    for (var off = 0; off < bytes.length; off += MAX_DATA) {
      this.send(CMD.WRTE, st.id, st.hostId, bytes.subarray(off, off + MAX_DATA));
    }
  };

  function u32(n) {
    var b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0, true);
    return b;
  }

  VirtualAdb.prototype.syncFeed = function (st, bytes) {
    var buf = st.carry.length ? concat(st.carry, bytes) : bytes;
    st.carry = EMPTY;
    var off = 0;
    while (off < buf.length) {
      if (st.mode === 'body') {
        var n = Math.min(st.remaining, buf.length - off);
        var slice = buf.subarray(off, off + n);
        off += n;
        st.remaining -= n;
        if (st.bodyKind === 'DATA') {
          st.fileChunks.push(slice.slice());
          st.fileSize += n;
        } else {
          st.bodyParts.push(slice.slice());
        }
        if (st.remaining === 0) {
          this.syncBodyDone(st);
          st.mode = 'hdr';
        }
      } else {
        if (buf.length - off < 8) break;
        var id = String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
        var len = new DataView(buf.buffer, buf.byteOffset + off + 4, 4).getUint32(0, true);
        off += 8;
        if (id === 'DATA') {
          st.mode = 'body'; st.bodyKind = 'DATA'; st.remaining = len;
          if (len === 0) st.mode = 'hdr';
        } else if (id === 'SEND' || id === 'STAT' || id === 'LIST' || id === 'RECV') {
          st.mode = 'body'; st.bodyKind = id; st.remaining = len; st.bodyParts = [];
          if (len === 0) { st.bodyParts = [EMPTY]; this.syncBodyDone(st); st.mode = 'hdr'; }
        } else if (id === 'DONE') {
          this.syncFileDone(st);
        } else if (id === 'QUIT') {
          this.finish(st, '');
          return;
        } else {
          log('Unknown sync command', id);
        }
      }
    }
    if (off < buf.length) st.carry = buf.slice(off);
  };

  VirtualAdb.prototype.syncBodyDone = function (st) {
    if (st.bodyKind === 'DATA') return;
    var body = dec.decode(joinParts(st.bodyParts));
    if (st.bodyKind === 'SEND') {
      var comma = body.lastIndexOf(',');
      st.filePath = comma >= 0 ? body.slice(0, comma) : body;
      st.fileChunks = [];
      st.fileSize = 0;
      log('SYNC SEND', st.filePath);
      if (ui.setStatus) ui.setStatus('Receiving ' + st.filePath.split('/').pop() + '...', '#60a5fa');
    } else if (st.bodyKind === 'STAT') {
      var f = this.files[body];
      var mode = f ? 0x81a4 : dirMode(body);
      log('SYNC STAT', body, '->', f ? 'file' : (mode ? 'dir' : 'missing'));
      this.syncReply(st, [enc.encode('STAT'), u32(mode), u32(f ? f.size : 0), u32(0)]);
    } else if (st.bodyKind === 'LIST') {
      log('SYNC LIST', body);
      this.syncReply(st, [enc.encode('DONE'), u32(0), u32(0), u32(0), u32(0)]);
    } else {
      log('SYNC', st.bodyKind, body);
      this.syncReply(st, [enc.encode('FAIL'), u32(9), enc.encode('No such')]);
    }
  };

  VirtualAdb.prototype.syncFileDone = function (st) {
    if (!st.filePath) return;
    log('SYNC DONE', st.filePath, fmtSize(st.fileSize));
    this.files[st.filePath] = { chunks: st.fileChunks, size: st.fileSize };
    if (st.fileSize > 1024 && looksLikeZip(st.fileChunks[0])) {
      registerApk(st.filePath.split('/').pop(), st.fileChunks, 'adb-sync');
    }
    st.filePath = null;
    this.syncReply(st, [enc.encode('OKAY'), u32(0)]);
  };

  /* ------------------------------------------------------------------ */
  /* Fake WebUSB device + navigator.usb                                  */
  /* ------------------------------------------------------------------ */
  var adb = new VirtualAdb();
  function buildDevice() {
    function ep(dir) { return { endpointNumber: 1, direction: dir, type: 'bulk', packetSize: 512 }; }
    var alt = {
      alternateSetting: 0, interfaceClass: 255, interfaceSubclass: 66, interfaceProtocol: 1,
      interfaceName: 'ADB Interface', endpoints: [ep('out'), ep('in')]
    };
    var iface = { interfaceNumber: 0, alternate: alt, alternates: [alt], claimed: false };
    var config = { configurationValue: 1, configurationName: null, interfaces: [iface] };
    var opened = false;
    var dev = (typeof USBDevice !== 'undefined') ? Object.create(USBDevice.prototype) : {};
    function ro(name, value) { Object.defineProperty(dev, name, { value: value, enumerable: true, configurable: true }); }
    ro('usbVersionMajor', 2); ro('usbVersionMinor', 0); ro('usbVersionSubminor', 0);
    ro('deviceClass', 0); ro('deviceSubclass', 0); ro('deviceProtocol', 0);
    ro('vendorId', 0x18d1); ro('productId', 0x4ee7);
    ro('deviceVersionMajor', 4); ro('deviceVersionMinor', 0); ro('deviceVersionSubminor', 0);
    ro('manufacturerName', 'Google'); ro('productName', 'APK Bridge Phone'); ro('serialNumber', 'APKBRIDGE0001');
    ro('configuration', config); ro('configurations', [config]);
    Object.defineProperty(dev, 'opened', { get: function () { return opened; }, enumerable: true, configurable: true });

    function method(name, fn) { Object.defineProperty(dev, name, { value: fn, writable: true, enumerable: false, configurable: true }); }
    method('open', function () {
      log('USB device.open()');
      adb.reset();
      opened = true;
      return Promise.resolve();
    });
    method('close', function () {
      log('USB device.close()');
      opened = false;
      adb.abortReaders();
      return Promise.resolve();
    });
    method('forget', function () { return Promise.resolve(); });
    method('reset', function () { adb.reset(); return Promise.resolve(); });
    method('selectConfiguration', function (v) { log('USB selectConfiguration', v); return Promise.resolve(); });
    method('claimInterface', function (n) { log('USB claimInterface', n); iface.claimed = true; return Promise.resolve(); });
    method('releaseInterface', function () { iface.claimed = false; return Promise.resolve(); });
    method('selectAlternateInterface', function () { return Promise.resolve(); });
    method('clearHalt', function () { return Promise.resolve(); });
    method('controlTransferIn', function (setup, length) {
      return Promise.resolve({ status: 'ok', data: new DataView(new ArrayBuffer(0)) });
    });
    method('controlTransferOut', function (setup, data) {
      return Promise.resolve({ status: 'ok', bytesWritten: data ? data.byteLength || 0 : 0 });
    });
    method('transferOut', function (endpoint, data) {
      var bytes = toBytes(data);
      adb.write(bytes);
      return Promise.resolve({ status: 'ok', bytesWritten: bytes.length });
    });
    method('transferIn', function (endpoint, length) {
      return adb.read(length).then(function (chunk) {
        return { status: 'ok', data: new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength) };
      });
    });
    return dev;
  }

  var fakeDevice = buildDevice();
  var fakeUsb = {
    onconnect: null,
    ondisconnect: null,
    getDevices: function () {
      log('navigator.usb.getDevices()');
      return Promise.resolve([fakeDevice]);
    },
    requestDevice: function (opts) {
      log('navigator.usb.requestDevice()', opts || {});
      if (ui.setStatus) ui.setStatus('AI Studio is connecting...', '#fbbf24');
      return Promise.resolve(fakeDevice);
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    dispatchEvent: function () { return true; }
  };
  try {
    Object.defineProperty(navigator, 'usb', { get: function () { return fakeUsb; }, configurable: true, enumerable: true });
    log('Virtual USB phone installed (v1.0.0)');
  } catch (e) {
    log('Could not override navigator.usb:', String(e));
  }

  /* ------------------------------------------------------------------ */
  /* Safety nets: APK blobs / fetches                                    */
  /* ------------------------------------------------------------------ */
  try {
    URL.createObjectURL = function (obj) {
      try {
        if (obj instanceof Blob && (!seenBlobs || !seenBlobs.has(obj)) &&
            /android\.package-archive/i.test(obj.type || '')) {
          registerBlob(obj, 'blob-url');
        }
      } catch (e) {}
      return origCreateObjectURL(obj);
    };
  } catch (e) { log('createObjectURL hook failed', String(e)); }

  try {
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function () {
        var p = origFetch.apply(this, arguments);
        try {
          p.then(function (res) {
            try {
              var type = res.headers.get('content-type') || '';
              if (/android\.package-archive/i.test(type) || /\.apk(\?|#|$)/i.test(res.url || '')) {
                res.clone().blob().then(function (b) {
                  if (b.size > 1024 && (!seenBlobs || !seenBlobs.has(b))) registerBlob(b, 'fetch', res.url);
                }).catch(function () {});
              }
            } catch (e) {}
          }).catch(function () {});
        } catch (e) {}
        return p;
      };
    }
  } catch (e) { log('fetch hook failed', String(e)); }

  /* ------------------------------------------------------------------ */
  /* On-page UI (built with DOM + CSSOM only: safe under strict CSP)     */
  /* ------------------------------------------------------------------ */
  if (!IS_TOP) return;

  function el(tag, style, text) {
    var e = document.createElement(tag);
    if (style) Object.assign(e.style, style);
    if (text != null) e.textContent = text;
    return e;
  }

  function mountUi() {
    if (document.getElementById('apk-bridge-root')) return;
    var host = el('div', { position: 'fixed', right: '12px', bottom: '12px', zIndex: '2147483647', all: 'initial' });
    host.id = 'apk-bridge-root';
    Object.assign(host.style, { position: 'fixed', right: '12px', bottom: '12px', zIndex: '2147483647' });
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var font = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    var wrap = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', fontFamily: font });

    /* panel */
    var panel = el('div', {
      display: 'none', width: 'min(340px, calc(100vw - 24px))', maxHeight: '70vh', overflow: 'auto',
      background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '16px',
      padding: '14px', boxShadow: '0 10px 40px rgba(0,0,0,.5)', boxSizing: 'border-box', fontSize: '13px'
    });
    var head = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' });
    head.appendChild(el('div', { fontWeight: '700', fontSize: '15px' }, 'APK Bridge'));
    var closeBtn = el('button', { background: 'transparent', color: '#94a3b8', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px 8px' }, '✕');
    head.appendChild(closeBtn);
    panel.appendChild(head);

    var statusRow = el('div', { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' });
    var dot = el('span', { width: '10px', height: '10px', borderRadius: '50%', background: '#64748b', flex: '0 0 auto' });
    var statusText = el('span', { color: '#cbd5e1' }, 'Ready. Tap "Install via USB" in AI Studio.');
    statusRow.appendChild(dot);
    statusRow.appendChild(statusText);
    panel.appendChild(statusRow);

    var list = el('div', { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' });
    var empty = el('div', { color: '#94a3b8', fontSize: '12px', lineHeight: '1.5' },
      'No APK captured yet. Build your app in AI Studio, tap "Install via USB", and the APK will show up here.');
    list.appendChild(empty);
    panel.appendChild(list);

    var btnRow = el('div', { display: 'flex', gap: '8px' });
    function smallBtn(label) {
      return el('button', {
        flex: '1', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
        borderRadius: '10px', padding: '8px 10px', fontSize: '12px', cursor: 'pointer'
      }, label);
    }
    var copyBtn = smallBtn('Copy logs');
    var logBtn = smallBtn('Show logs');
    btnRow.appendChild(copyBtn);
    btnRow.appendChild(logBtn);
    panel.appendChild(btnRow);

    var logBox = el('pre', {
      display: 'none', margin: '10px 0 0', padding: '8px', background: '#020617', color: '#94a3b8',
      borderRadius: '8px', fontSize: '10px', lineHeight: '1.4', maxHeight: '160px', overflow: 'auto',
      whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'ui-monospace,Menlo,monospace'
    });
    panel.appendChild(logBox);

    /* pill */
    var pill = el('button', {
      display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a', color: '#fff',
      border: '1px solid #334155', borderRadius: '999px', padding: '9px 14px', fontSize: '13px',
      fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.4)', fontFamily: font
    });
    var pillDot = el('span', { width: '9px', height: '9px', borderRadius: '50%', background: '#4ade80' });
    var pillText = el('span', null, 'APK Bridge');
    pill.appendChild(pillDot);
    pill.appendChild(pillText);
    wrap.appendChild(panel);
    wrap.appendChild(pill);
    root.appendChild(wrap);

    var open = false;
    function setOpen(v) { open = v; panel.style.display = v ? 'block' : 'none'; }
    pill.addEventListener('click', function () { setOpen(!open); });
    closeBtn.addEventListener('click', function () { setOpen(false); });

    var showLogs = false;
    logBtn.addEventListener('click', function () {
      showLogs = !showLogs;
      logBox.style.display = showLogs ? 'block' : 'none';
      logBtn.textContent = showLogs ? 'Hide logs' : 'Show logs';
      ui.refreshLogs();
    });

    copyBtn.addEventListener('click', function () {
      var text = 'AI Studio APK Bridge logs\n' + navigator.userAgent + '\n\n' + logs.join('\n');
      var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy logs'; }, 1800); };
      try {
        navigator.clipboard.writeText(text).then(done, fallback);
      } catch (e) { fallback(); }
      function fallback() {
        var ta = el('textarea', { position: 'fixed', opacity: '0' });
        ta.value = text;
        root.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        ta.remove();
      }
    });

    ui.setStatus = function (text, color) {
      statusText.textContent = text;
      dot.style.background = color || '#64748b';
      pillDot.style.background = color || '#4ade80';
    };
    ui.refreshLogs = function () {
      if (!showLogs) return;
      logBox.textContent = logs.slice(-40).join('\n');
      logBox.scrollTop = logBox.scrollHeight;
    };
    ui.onCapture = function (item) {
      if (empty.parentNode) empty.remove();
      var card = el('div', { background: '#0b3b2a', border: '1px solid #16a34a', borderRadius: '12px', padding: '12px' });
      card.appendChild(el('div', { fontWeight: '700', color: '#bbf7d0', marginBottom: '2px' }, 'APK ready'));
      card.appendChild(el('div', { color: '#d1fae5', fontSize: '12px', marginBottom: '10px', wordBreak: 'break-all' },
        item.name + ' (' + fmtSize(item.size) + ')'));
      var dl = el('button', {
        width: '100%', background: '#22c55e', color: '#052e16', border: 'none', borderRadius: '10px',
        padding: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer'
      }, 'Download APK');
      dl.addEventListener('click', function () { downloadItem(item); });
      card.appendChild(dl);
      card.appendChild(el('div', { color: '#a7f3d0', fontSize: '11px', marginTop: '8px', lineHeight: '1.5' },
        'Then open the downloaded file and tap Install. If Android asks, allow installs from your browser.'));
      list.insertBefore(card, list.firstChild);
      ui.setStatus('APK captured (' + fmtSize(item.size) + ')', '#22c55e');
      pillText.textContent = 'APK ready';
      setOpen(true);
    };

    ui.setStatus('Ready. Tap "Install via USB" in AI Studio.', '#4ade80');
    (document.body || document.documentElement).appendChild(host);
  }

  if (document.body) mountUi();
  else document.addEventListener('DOMContentLoaded', mountUi);

  setInterval(function () {
    if (document.body && !document.getElementById('apk-bridge-root')) mountUi();
  }, 3000);
})();