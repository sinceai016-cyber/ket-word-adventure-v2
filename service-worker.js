const CACHE='ket-word-planet-v15';
const HOME='./index.html';
const FILES=['./',HOME,'./styles.css?v=15','./overrides.css?v=15','./words.js?v=15','./schedule.js?v=15','./app.js?v=15','./manifest.webmanifest?v=15','./word-planet-hero.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  // Use the newest page while online and the saved page while offline.
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(HOME,copy));
          return response;
        })
        .catch(()=>caches.match(HOME).then(hit=>hit||caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }))
  );
});
