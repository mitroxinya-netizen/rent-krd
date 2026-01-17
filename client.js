(() => {
  const fmt = new Intl.NumberFormat('ru-RU');
  const favKey = 'krd_rent_favs_v1';

  const byId = (id) => document.getElementById(id);

  function loadFavs(){
    try { return new Set(JSON.parse(localStorage.getItem(favKey) || '[]')); }
    catch { return new Set(); }
  }
  function saveFavs(set){ localStorage.setItem(favKey, JSON.stringify([...set])); }

  // ===== Index page enhancements =====
  if (window.__PAGE === 'index' && window.__DATA) {
    const data = window.__DATA.apartments || [];
    const site = window.__DATA.site || {};
    const favs = loadFavs();

    const kpi = byId('kpiCount');
    if (kpi) kpi.textContent = String(data.length);

    // contacts
    const c = (site.contacts || {});
    const tgTop = byId('tgTop');
    const vkTop = byId('vkTop');
    const waTop = byId('waTop');
    const callTop = byId('callTop');
    if (tgTop) tgTop.href = c.telegram || '#';
    if (vkTop) vkTop.href = c.vk || '#';
    if (waTop) waTop.href = c.whatsapp || '#';
    if (callTop) callTop.href = c.phone ? `tel:${c.phone}` : '#';

    const footerContacts = byId('footerContacts');
    if (footerContacts) {
      footerContacts.innerHTML = [
        c.telegram ? `<a href="${c.telegram}">Telegram</a>` : '',
        c.vk ? `<a href="${c.vk}">VK</a>` : '',
        c.whatsapp ? `<a href="${c.whatsapp}">WhatsApp</a>` : '',
        c.phone ? `<a href="tel:${c.phone}">${c.phone}</a>` : ''
      ].filter(Boolean).join(' · ');
    }
    const year = byId('year');
    if (year) year.textContent = String(new Date().getFullYear());

    // filter controls
    const q = byId('q');
    const district = byId('district');
    const guests = byId('guests');
    const type = byId('type');
    const maxPrice = byId('maxPrice');
    const maxPriceLabel = byId('maxPriceLabel');
    const onlyFav = byId('onlyFav');

    if (district) {
      const districts = [...new Set(data.map(x => x.district).filter(Boolean))].sort();
      for (const d of districts) {
        const o = document.createElement('option');
        o.value = d; o.textContent = d;
        district.appendChild(o);
      }
    }

    if (maxPrice && maxPriceLabel) {
      const max = Math.max(...data.map(x => Number(x.price || 0)), 15000);
      maxPrice.max = String(Math.ceil(max / 500) * 500);
      maxPrice.value = maxPrice.max;
      maxPriceLabel.textContent = fmt.format(Number(maxPrice.value));
      maxPrice.addEventListener('input', () => {
        maxPriceLabel.textContent = fmt.format(Number(maxPrice.value));
        render();
      });
    }

    ;[q, district, guests, type, onlyFav].forEach(el => {
      if (!el) return;
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });

    function typeLabel(t){
      return ({studio:'Студия','1k':'1к','2k':'2к','3k':'3к'}[t] || 'Квартира');
    }

    function render(){
      const query = (q?.value || '').trim().toLowerCase();
      const d = district?.value || '';
      const g = Number(guests?.value || 0);
      const t = type?.value || '';
      const mp = Number(maxPrice?.value || Infinity);
      const favOnly = !!onlyFav?.checked;

      const favsNow = loadFavs();

      const items = data.filter(x => {
        if (d && x.district !== d) return false;
        if (t && x.type !== t) return false;
        if (Number(x.price || 0) > mp) return false;
        if (g && Number(x.guests || 0) < g) return false;
        if (favOnly && !favsNow.has(x.id)) return false;
        if (query) {
          const hay = [x.title, x.address, x.district, ...(x.amenities||[]), ...(x.badges||[])].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });

      // show/hide cards
      const all = document.querySelectorAll('[data-apt]');
      const keep = new Set(items.map(x => x.id));
      for (const node of all) {
        node.hidden = !keep.has(node.getAttribute('data-apt'));
        // update fav icon
        const btn = node.querySelector('[data-fav]');
        if (btn) {
          const id = node.getAttribute('data-apt');
          const on = favsNow.has(id);
          btn.textContent = on ? '♥' : '♡';
          btn.setAttribute('data-on', on ? '1' : '0');
        }
      }

      const empty = byId('empty');
      if (empty) empty.hidden = items.length !== 0;

      // map markers
      if (window.__MAP) window.__MAP.renderMarkers(items);
    }

    // fav toggle
    document.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-fav]');
      if (!btn) return;
      const id = btn.getAttribute('data-fav');
      const s = loadFavs();
      if (s.has(id)) s.delete(id); else s.add(id);
      saveFavs(s);
      render();
    });

    // map
    const mapBox = byId('mapBox');
    if (mapBox && window.L) {
      const centerLat = site.map?.centerLat ?? 45.03547;
      const centerLng = site.map?.centerLng ?? 38.97531;
      const zoom = site.map?.zoom ?? 12;

      const map = L.map('mapBox', { zoomControl:true }).setView([centerLat, centerLng], zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      const markers = [];

      function clearMarkers(){
        for (const m of markers) m.remove();
        markers.length = 0;
      }

      function renderMarkers(items){
        clearMarkers();
        for (const x of items) {
          if (typeof x.lat !== 'number' || typeof x.lng !== 'number') continue;
          const m = L.marker([x.lat, x.lng]).addTo(map);
          const url = `/apartment/${encodeURIComponent(x.id)}/`;
          m.bindPopup(`<b>${escapeHtml(x.title||'Квартира')}</b><br>${fmt.format(Number(x.price||0))} ₽/сут<br><a href="${url}">Открыть</a>`);
          markers.push(m);
        }
      }

      window.__MAP = { map, renderMarkers };
      renderMarkers(data);
    }

    render();
  }

  // ===== Apartment page: contacts buttons =====
  if (window.__PAGE === 'apartment' && window.__APT && window.__SITE) {
    const c = (window.__SITE.contacts || {});
    const apt = window.__APT;

    const tg = byId('btnTg');
    const vk = byId('btnVk');
    const wa = byId('btnWa');
    const call = byId('btnCall');

    const msg = encodeURIComponent(`Здравствуйте! Хочу забронировать: ${apt.title}. Даты: __ / __. Гостей: __. Ссылка: ${location.href}`);

    if (tg) tg.href = c.telegram ? `${c.telegram}?text=${msg}` : '#';
    if (vk) vk.href = c.vk || '#';
    if (wa) wa.href = c.whatsapp ? `${c.whatsapp}?text=${msg}` : '#';
    if (call) call.href = c.phone ? `tel:${c.phone}` : '#';

    // favorite
    const favBtn = byId('favBtn');
    if (favBtn) {
      const set = loadFavs();
      const refresh = () => {
        const on = set.has(apt.id);
        favBtn.textContent = on ? '♥ В избранном' : '♡ В избранное';
        favBtn.dataset.on = on ? '1' : '0';
      };
      refresh();
      favBtn.addEventListener('click', () => {
        if (set.has(apt.id)) set.delete(apt.id); else set.add(apt.id);
        saveFavs(set);
        refresh();
      });
    }

    // small map
    const mapBox = byId('aptMap');
    if (mapBox && window.L && typeof apt.lat === 'number' && typeof apt.lng === 'number') {
      const map = L.map('aptMap', { zoomControl:true, dragging:!L.Browser.mobile }).setView([apt.lat, apt.lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      L.marker([apt.lat, apt.lng]).addTo(map);
    }
  }

  function escapeHtml(s=''){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  }
})();
