// Polyfills for crypto libraries in browser environment
if (typeof global === 'undefined') {
  window.global = window;
}

if (typeof Buffer === 'undefined') {
  window.Buffer = {
    from: function(data, encoding) {
      if (typeof data === 'string') {
        return btoa(data);
      }
      return data;
    },
    alloc: function(size) {
      return new Uint8Array(size);
    },
    isBuffer: function(obj) {
      return obj instanceof Uint8Array;
    },
    toString: function(encoding) {
      return '';
    }
  };
}

if (typeof process === 'undefined') {
  window.process = {
    env: {},
    version: 'v16.0.0',
    versions: {
      node: '16.0.0'
    },
    browser: true,
    nextTick: function(fn) {
      setTimeout(fn, 0);
    }
  };
}