(() => {
  'use strict';

  const WHATSAPP_NUMBER = '918939938042';

  // 1. Fallback for browsers without native <dialog closedby="any"> light-dismiss
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const isOutside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    document.querySelectorAll('dialog[closedby="any"]').forEach((dialog) => {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = isOutside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && isOutside(e, dialog)) dialog.close();
      });
    });
  }

  // Fallback for Invoker Commands (command="show-modal" / command="close") if unsupported
  if (!('commandForElement' in HTMLButtonElement.prototype)) {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[command][commandfor]');
      if (!btn) return;
      const target = document.getElementById(btn.getAttribute('commandfor'));
      if (!target) return;
      const cmd = btn.getAttribute('command');
      if (cmd === 'show-modal' && typeof target.showModal === 'function') {
        target.showModal();
      } else if (cmd === 'close' && typeof target.close === 'function') {
        target.close();
      }
    });
  }

  // Close mobile nav drawer when a navigation link is clicked
  const mobileDialog = document.getElementById('mobile-nav-dialog');
  if (mobileDialog) {
    mobileDialog.querySelectorAll('[data-mobile-link]').forEach((link) => {
      link.addEventListener('click', () => mobileDialog.close());
    });
  }

  // 2. Interactive Product Galleries
  document.querySelectorAll('.product-gallery').forEach((gallery) => {
    const mainImg = gallery.querySelector('.gallery-main-img');
    const zoomBtn = gallery.querySelector('[data-gallery-zoom]');
    const captionEl = gallery.querySelector('[data-gallery-caption]');
    const thumbs = gallery.querySelectorAll('.thumb-btn');

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        thumbs.forEach((t) => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        thumb.classList.add('is-active');
        thumb.setAttribute('aria-selected', 'true');

        const src = thumb.dataset.src;
        const alt = thumb.dataset.alt;
        const title = thumb.dataset.title;
        const caption = thumb.dataset.caption;

        if (mainImg && src) {
          mainImg.src = src;
          mainImg.alt = alt || '';
        }
        if (captionEl && caption) {
          captionEl.textContent = caption;
        }
        if (zoomBtn) {
          zoomBtn.dataset.lightboxSrc = src || '';
          zoomBtn.dataset.lightboxTitle = title || 'Product Preview';
          zoomBtn.dataset.lightboxCaption = caption || '';
        }
      });
    });

    // Sync initial active thumb metadata to zoom button
    const initialActive = gallery.querySelector('.thumb-btn.is-active');
    if (initialActive && zoomBtn) {
      zoomBtn.dataset.lightboxSrc = initialActive.dataset.src || '';
      zoomBtn.dataset.lightboxTitle = initialActive.dataset.title || 'Product Preview';
      zoomBtn.dataset.lightboxCaption = initialActive.dataset.caption || '';
    }
  });

  // 3. Product Image Lightbox (<dialog closedby="any">)
  const lightbox = document.getElementById('lightbox-dialog');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxCaption = document.getElementById('lightbox-caption');

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.image-zoom-trigger');
    if (!trigger || !lightbox) return;

    const src = trigger.dataset.lightboxSrc || trigger.querySelector('img')?.getAttribute('src') || '';
    const alt = trigger.querySelector('img')?.getAttribute('alt') || 'Product image';
    const title = trigger.dataset.lightboxTitle || 'Product Preview';
    const caption = trigger.dataset.lightboxCaption || '';

    lightboxImg.src = src;
    lightboxImg.alt = alt;
    lightboxTitle.textContent = title;
    lightboxCaption.textContent = caption;
    lightbox.showModal();
  });

  if (lightbox) {
    lightbox.addEventListener('close', () => {
      lightbox.returnValue = '';
    });
  }

  // 4. Accessible Form Validation + WhatsApp Inquiry Submission
  const form = document.getElementById('whatsapp-inquiry-form');
  const formStatus = document.getElementById('form-status');

  if (form) {
    const linkError = (el, shown) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    };

    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.classList.add('visually-hidden');
    document.body.append(announcer);
    let announceTimer;
    let announcedField;

    const spokenText = (node) => {
      const copy = node.cloneNode(true);
      copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
      copy.querySelectorAll('[role="img"][aria-label]').forEach((n) =>
        n.replaceWith(`${n.getAttribute('aria-label')}: `)
      );
      return copy.textContent.replace(/\s+/g, ' ').trim();
    };

    const announceError = (el) => {
      const error = document.getElementById(el.dataset.error);
      if (!error) return;
      const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
      clearTimeout(announceTimer);
      announcer.textContent = '';
      announcedField = el;
      announceTimer = setTimeout(() => {
        announcer.textContent = label + spokenText(error);
      }, 500);
    };

    const flagged = new WeakSet();
    const announced = new WeakSet();
    const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
    const dirtyState = new WeakMap();

    const syncAria = (el, announce = false) => {
      if (!el.matches?.('input, select, textarea')) return;
      const invalid = supportsUserInvalid
        ? el.matches(':user-invalid')
        : (dirtyState.get(el)?.hasInteracted && dirtyState.get(el)?.hasBlurred && !el.validity.valid);

      if (!supportsUserInvalid && dirtyState.get(el)?.hasBlurred) {
        el.classList.toggle('user-invalid-fallback', !el.validity.valid);
        el.classList.toggle('user-valid-fallback', el.validity.valid);
      }

      if (invalid) {
        if (announce && !announced.has(el)) {
          announceError(el);
          announced.add(el);
        }
        el.setAttribute('aria-invalid', 'true');
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
        el.setAttribute('aria-invalid', 'false');
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el) {
          clearTimeout(announceTimer);
          announcer.textContent = '';
        }
      }
    };

    form.querySelectorAll('input, select, textarea').forEach((el) => syncAria(el));

    form.addEventListener('blur', (e) => {
      const st = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
      st.hasBlurred = true;
      dirtyState.set(e.target, st);
      syncAria(e.target, true);
    }, true);

    form.addEventListener('input', (e) => {
      const st = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
      st.hasInteracted = true;
      dirtyState.set(e.target, st);
      if (e.target.hasAttribute('aria-invalid')) syncAria(e.target);
    });

    form.addEventListener('change', (e) => {
      const st = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
      st.hasInteracted = true;
      st.hasBlurred = true;
      dirtyState.set(e.target, st);
      syncAria(e.target, true);
    }, true);

    form.addEventListener('invalid', (e) => {
      const st = dirtyState.get(e.target) || { hasInteracted: false, hasBlurred: false };
      st.hasInteracted = true;
      st.hasBlurred = true;
      dirtyState.set(e.target, st);
      announced.add(e.target);
      syncAria(e.target);
    }, true);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        const firstInvalid = form.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
        if (formStatus) formStatus.textContent = 'Please complete the highlighted required fields.';
        return;
      }

      const name = document.getElementById('inq-name').value.trim();
      const phone = document.getElementById('inq-phone').value.trim();
      const product = document.getElementById('inq-product').value.trim();
      const message = document.getElementById('inq-message').value.trim();

      const lines = [
        'Hello KSE International Enterprises (Kumar),',
        `Name: ${name}`,
        `Phone: ${phone}`,
        `Product of Interest: ${product}`
      ];
      if (message) lines.push(`Message: ${message}`);

      const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
      if (formStatus) {
        formStatus.textContent = 'Opening WhatsApp with your inquiry...';
      }
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    });
  }

  // 5. Subtle Scroll-Reveal Animations
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealEls.forEach((el) => el.classList.add('will-reveal'));
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => observer.observe(el));
  }
})();
