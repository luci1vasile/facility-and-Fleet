/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  importScripts("/sw-background.js");
  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "sw-background.js",
    "revision": "0fce1333317ddbe0149435594a28ce9f"
  }, {
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "8503606098341b8965e0694ef086ba72"
  }, {
    "url": "pwa-512x512.png",
    "revision": "10589300f15a2d252fbf6fe43a303931"
  }, {
    "url": "pwa-192x192.png",
    "revision": "9e76e66011ca8eee49ea015208d108b8"
  }, {
    "url": "index.html",
    "revision": "0ec68f094b15b32456040fcf853793b6"
  }, {
    "url": "icon.svg",
    "revision": "c8a93586dbe74d8652bca293a6bc58f0"
  }, {
    "url": "favicon.ico",
    "revision": "4e3adc1c364b675938bfe4d08e8d035f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "edaf4e313c83901c1a1a3933ca8b53f9"
  }, {
    "url": "assets/purify.es-Bvo9QlJ8.js",
    "revision": null
  }, {
    "url": "assets/index.es-mbAeol9-.js",
    "revision": null
  }, {
    "url": "assets/index-Bs4A2x3S.js",
    "revision": null
  }, {
    "url": "assets/index-B_XJOsr6.css",
    "revision": null
  }, {
    "url": "assets/html2canvas-BJjaLZPQ.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "edaf4e313c83901c1a1a3933ca8b53f9"
  }, {
    "url": "favicon.ico",
    "revision": "4e3adc1c364b675938bfe4d08e8d035f"
  }, {
    "url": "icon.svg",
    "revision": "c8a93586dbe74d8652bca293a6bc58f0"
  }, {
    "url": "pwa-192x192.png",
    "revision": "9e76e66011ca8eee49ea015208d108b8"
  }, {
    "url": "pwa-512x512.png",
    "revision": "10589300f15a2d252fbf6fe43a303931"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "8503606098341b8965e0694ef086ba72"
  }, {
    "url": "manifest.webmanifest",
    "revision": "79d453406cb34571f2ae90289f090475"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /\.xlsx$/i, /\.pdf$/i, /\.json$/i, /\.zip$/i]
  }));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
