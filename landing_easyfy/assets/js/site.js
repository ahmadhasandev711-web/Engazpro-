/* Easyfy — easyfy.cloud */
(function () {
  'use strict';
  var WA = '201125030642';
  var API_BASE = 'https://api.easyfy.cloud/api';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Sticky nav scroll border
  var nav = document.getElementById('nav');
  function onScroll() {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // 2. Mobile menu drawer
  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');
  function setMenu(open) {
    if (!drawer || !burger) return;
    drawer.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      setMenu(!drawer.classList.contains('open'));
    });
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
  }

  // 3. Scroll reveal observer
  var items = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // 4. Hero product shot subtle 3D scroll settle
  var tilt = document.getElementById('tilt');
  if (tilt && !reduce) {
    var ticking = false;
    var applyTilt = function () {
      var r = tilt.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.9)));
      tilt.style.transform = 'rotateX(' + (8 * (1 - p)).toFixed(2) + 'deg) scale(' + (0.97 + 0.03 * p).toFixed(3) + ')';
      ticking = false;
    };
    applyTilt();
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyTilt);
      }
    }, { passive: true });
  }

  // 5. Interactive Showcase tabs
  var tabs = document.querySelectorAll('.tab[role=tab]');
  var screenImg = document.getElementById('showcase-img');
  var showcaseFrame = document.getElementById('showcase-frame');
  var showcaseUrl = document.getElementById('showcase-url');
  var autoTimer = null;

  function selectTab(tab, userInitiated) {
    tabs.forEach(function (t) {
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    if (!screenImg) return;
    screenImg.classList.add('swap');
    setTimeout(function () {
      screenImg.src = tab.dataset.src;
      screenImg.srcset = tab.dataset.set;
      screenImg.alt = tab.dataset.alt;
      if (showcaseUrl && tab.dataset.url) showcaseUrl.textContent = tab.dataset.url;
      if (showcaseFrame) {
        showcaseFrame.setAttribute('data-lb-src', tab.dataset.full || tab.dataset.src);
        showcaseFrame.setAttribute('data-lb-cap', tab.dataset.cap || tab.dataset.alt);
      }
      screenImg.classList.remove('swap');
    }, reduce ? 0 : 160);
    if (userInitiated && autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t, true); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, next = null;
      if (k === 'ArrowDown' || k === 'ArrowLeft') next = tabs[(i + 1) % tabs.length];
      if (k === 'ArrowUp' || k === 'ArrowRight') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) {
        e.preventDefault();
        next.focus();
        selectTab(next, true);
      }
    });
  });

  if (tabs.length && !reduce && 'IntersectionObserver' in window) {
    var idx = 0;
    var showcaseSec = document.getElementById('showcase');
    if (showcaseSec) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && !autoTimer) {
          autoTimer = setInterval(function () {
            idx = (idx + 1) % tabs.length;
            selectTab(tabs[idx], false);
          }, 4800);
        } else if (!en[0].isIntersecting && autoTimer) {
          clearInterval(autoTimer);
          autoTimer = null;
        }
      }, { threshold: 0.25 }).observe(showcaseSec);
    }
  }

  // 6. Lightbox preview modal
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lbCap = document.getElementById('lb-cap');
  var lbClose = document.getElementById('lb-close');

  function openLightbox(src, cap) {
    if (!lb || !lbImg || !src) return;
    lbImg.src = src;
    lbImg.alt = cap || '';
    if (lbCap) lbCap.textContent = cap || '';
    lb.classList.add('open');
  }
  function closeLightbox() {
    if (lb) lb.classList.remove('open');
  }
  document.querySelectorAll('[data-lb-src]').forEach(function (el) {
    el.addEventListener('click', function () {
      openLightbox(el.getAttribute('data-lb-src'), el.getAttribute('data-lb-cap'));
    });
  });
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      setMenu(false);
      closeLightbox();
    }
  });

  // 7. Live pricing toggle + API hydration
  var pricingState = {
    currency: 'ج.م',
    billing: 'annual',
    basic: { annual_price: 3990, monthly_price: 399, yearly_monthly_equivalent: 333, annual_savings: 798 },
    pro: { annual_price: 7500, monthly_price: 749, yearly_monthly_equivalent: 625, annual_savings: 1488 }
  };

  function fmtNum(n) {
    return Math.round(Number(n || 0)).toLocaleString('en-US');
  }
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function renderPricing() {
    var cur = pricingState.currency;
    var ann = pricingState.billing === 'annual';
    var b = pricingState.basic;
    var p = pricingState.pro;

    if (ann) {
      setText('price-basic-amt', fmtNum(b.annual_price));
      setText('price-basic-unit', cur + ' / سنوياً');
      setText('price-basic-note', 'ما يعادل ' + fmtNum(b.yearly_monthly_equivalent) + ' ' + cur + '/شهر — وفّر ' + fmtNum(b.annual_savings) + ' ' + cur);
      setText('price-pro-amt', fmtNum(p.annual_price));
      setText('price-pro-unit', cur + ' / سنوياً');
      setText('price-pro-note', 'ما يعادل ' + fmtNum(p.yearly_monthly_equivalent) + ' ' + cur + '/شهر — وفّر ' + fmtNum(p.annual_savings) + ' ' + cur);
    } else {
      setText('price-basic-amt', fmtNum(b.monthly_price));
      setText('price-basic-unit', cur + ' / شهرياً');
      setText('price-basic-note', 'فوترة شهرية بدون التزام سنوي');
      setText('price-pro-amt', fmtNum(p.monthly_price));
      setText('price-pro-unit', cur + ' / شهرياً');
      setText('price-pro-note', 'فوترة شهرية بدون التزام سنوي');
    }
  }

  document.querySelectorAll('[data-billing]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      pricingState.billing = btn.getAttribute('data-billing') || 'annual';
      document.querySelectorAll('[data-billing]').forEach(function (x) {
        x.classList.toggle('active', x === btn);
      });
      renderPricing();
    });
  });

  fetch(API_BASE + '/public/pricing', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (json) {
      if (!json || !json.success || !json.data) return;
      var d = json.data;
      if (d.trial_days) {
        document.querySelectorAll('[data-trial-days]').forEach(function (el) {
          el.textContent = String(d.trial_days);
        });
      }
      if (d.currency) pricingState.currency = d.currency;
      if (d.basic) pricingState.basic = d.basic;
      if (d.pro) pricingState.pro = d.pro;
      if (d.pro && d.pro.annual_discount_percent) {
        setText('annual-save-pill', 'وفّر ' + Math.round(d.pro.annual_discount_percent) + '%');
      }
      renderPricing();
    })
    .catch(function () {});

  // 8. Setup / Demo Inquiry Form -> API with WhatsApp fallback
  var form = document.getElementById('lead');
  var formOpenedAt = Date.now();
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var name = f.fullname.value.trim();
      var phone = f.phone.value.trim();
      var biz = f.biz.value;
      var branches = f.branches.value;
      var msg = f.msg.value.trim();
      var hp = f.company_ref ? f.company_ref.value : '';
      var statusEl = document.getElementById('lead-status');
      var submitBtn = document.getElementById('lead-submit');

      if (name.length < 2 || phone.replace(/\D/g, '').length < 8) {
        if (statusEl) {
          statusEl.className = 'form-status err';
          statusEl.textContent = 'اكتب اسمك ورقم موبايلك بشكل صحيح عشان فريقنا يتواصل معاك.';
        }
        (name.length < 2 ? f.fullname : f.phone).focus();
        return;
      }

      if (statusEl) {
        statusEl.className = 'form-status';
        statusEl.textContent = '';
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري إرسال طلبك...';
      }

      var notesCombined = ['عدد الفروع: ' + branches, msg].filter(Boolean).join(' | ');
      var elapsedMs = Math.max(0, Date.now() - formOpenedAt);

      fetch(API_BASE + '/landing/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name,
          phone: phone,
          business_type: biz,
          city: '',
          notes: notesCombined,
          company_ref: hp,
          elapsed_ms: elapsedMs
        })
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (data) {
            return { status: r.status, ok: r.ok, data: data };
          });
        })
        .then(function (res) {
          if (res.ok && res.data && res.data.success) {
            if (statusEl) {
              statusEl.className = 'form-status ok';
              statusEl.textContent = res.data.message || 'تم استلام طلبك بنجاح! فريق Easyfy هيتواصل معاك خلال ساعات.';
            }
            form.reset();
            formOpenedAt = Date.now();
          } else if (res.status === 429) {
            if (statusEl) {
              statusEl.className = 'form-status err';
              statusEl.textContent = (res.data && res.data.message) || 'تم إرسال طلب منذ قليل، يرجى الانتظار أو مراسلتنا على واتساب.';
            }
          } else {
            throw new Error('api_error');
          }
        })
        .catch(function () {
          var waText = [
            'أهلاً فريق Easyfy، أريد تجهيز متجر جديد:',
            'الاسم: ' + name,
            'الموبايل: ' + phone,
            'النشاط: ' + biz,
            'الفروع: ' + branches,
            msg ? 'التفاصيل: ' + msg : ''
          ].filter(Boolean).join('\n');
          if (statusEl) {
            statusEl.className = 'form-status err';
            statusEl.innerHTML = 'تعذر الإرسال التلقائي الآن — <a style="text-decoration:underline;font-weight:600" target="_blank" rel="noopener" href="https://wa.me/' + WA + '?text=' + encodeURIComponent(waText) + '">ابعت طلبك مباشرة على واتساب من هنا</a>.';
          }
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'اطلب تجهيز متجرك الآن<svg width="16" height="16" aria-hidden="true"><use href="#i-arrow"/></svg>';
          }
        });
    });
  }

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
})();
