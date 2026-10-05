document.addEventListener("DOMContentLoaded", function () {

  // "/img/<id>.webp" -> small "/img/<id>_s.webp" version (other URLs unchanged)
  function toThumb(url) {
    return typeof url === "string" ? url.replace(/^\/img\/([a-f0-9]{24})\.webp$/, "/img/$1_s.webp") : "";
  }

  var navToggle = document.querySelector("[data-nav-toggle]");
  var mainNav = document.querySelector("[data-main-nav]");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var open = mainNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var waToggle = document.querySelector("[data-whatsapp-toggle]");
  var waModal = document.querySelector("[data-whatsapp-modal]");
  if (waToggle && waModal) {
    waToggle.addEventListener("click", function () {
      waModal.hidden = false;
    });
    waModal.querySelectorAll("[data-whatsapp-close]").forEach(function (el) {
      el.addEventListener("click", function () {
        waModal.hidden = true;
      });
    });
  }

  var toggles = document.querySelectorAll("[data-dropdown-toggle]");
  toggles.forEach(function (toggle) {
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var dropdown = toggle.closest(".nav-dropdown");
      var wasOpen = dropdown.classList.contains("is-open");
      document.querySelectorAll(".nav-dropdown.is-open").forEach(function (d) {
        d.classList.remove("is-open");
      });
      if (!wasOpen) dropdown.classList.add("is-open");
    });
  });
  document.addEventListener("click", function () {
    document.querySelectorAll(".nav-dropdown.is-open").forEach(function (d) {
      d.classList.remove("is-open");
    });
  });

  document.querySelectorAll("form[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      if (!window.confirm(form.getAttribute("data-confirm"))) {
        e.preventDefault();
      }
    });
  });

  var mainImage = document.querySelector("[data-gallery-main]");
  var galleryEl = document.querySelector("[data-gallery]");
  if (galleryEl && mainImage) {
    var thumbsWrap = galleryEl.querySelector("[data-gallery-thumbs]");
    var galleryPrev = galleryEl.querySelector("[data-gallery-prev]");
    var galleryNext = galleryEl.querySelector("[data-gallery-next]");
    var galleryMap = {};
    try { galleryMap = JSON.parse(galleryEl.getAttribute("data-images") || "{}"); } catch (e) {}
    var galleryImages = [];
    var galleryIndex = 0;

    function renderThumbs() {
      thumbsWrap.innerHTML = "";
      if (galleryImages.length < 2) return;
      galleryImages.forEach(function (src, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "product-page__thumb-btn" + (i === 0 ? " is-active" : "");
        btn.addEventListener("click", function () { goToSlide(i); });
        var img = document.createElement("img");
        img.src = toThumb(src);
        img.loading = "lazy";
        img.alt = "";
        btn.appendChild(img);
        thumbsWrap.appendChild(btn);
      });
    }

    function goToSlide(i) {
      if (!galleryImages.length) return;
      galleryIndex = (i + galleryImages.length) % galleryImages.length;
      mainImage.classList.add("is-fading");
      setTimeout(function () {
        mainImage.src = galleryImages[galleryIndex];
        mainImage.classList.remove("is-fading");
      }, 150);
      var thumbBtns = thumbsWrap.querySelectorAll(".product-page__thumb-btn");
      thumbBtns.forEach(function (t, i2) { t.classList.toggle("is-active", i2 === galleryIndex); });
    }

    function setGallery(images) {
      galleryImages = images || [];
      galleryIndex = 0;
      if (galleryImages.length) mainImage.src = galleryImages[0];
      renderThumbs();
    }

    if (galleryPrev) galleryPrev.addEventListener("click", function () { goToSlide(galleryIndex - 1); });
    if (galleryNext) galleryNext.addEventListener("click", function () { goToSlide(galleryIndex + 1); });

    var colorSwatches = document.querySelectorAll("[data-color-swatch]");
    colorSwatches.forEach(function (sw) {
      sw.addEventListener("click", function () {
        colorSwatches.forEach(function (s) { s.classList.remove("is-active"); });
        sw.classList.add("is-active");
        setGallery(galleryMap[sw.getAttribute("data-color")]);
      });
    });

    setGallery(galleryMap[Object.keys(galleryMap)[0]]);
  }

  var zoomTrigger = document.querySelector("[data-zoom-trigger]");
  var lightbox = document.querySelector("[data-lightbox]");
  var lightboxImage = document.querySelector("[data-lightbox-image]");
  var lightboxClose = document.querySelector("[data-lightbox-close]");

  function openLightbox() {
    if (!lightbox || !lightboxImage || !mainImage) return;
    lightboxImage.src = mainImage.src;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.style.overflow = "";
  }
  if (zoomTrigger) zoomTrigger.addEventListener("click", openLightbox);
  if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLightbox();
  });

  var slider = document.querySelector("[data-slider]");
  if (slider) {
    var slides = Array.prototype.slice.call(slider.querySelectorAll("[data-slider-slide]"));
    var dots = Array.prototype.slice.call(slider.querySelectorAll("[data-slider-dot]"));
    var prevBtn = slider.querySelector("[data-slider-prev]");
    var nextBtn = slider.querySelector("[data-slider-next]");
    var current = 0;

    function goTo(index) {
      if (!slides.length) return;
      slides[current].classList.remove("is-active");
      if (dots[current]) dots[current].classList.remove("is-active");
      current = (index + slides.length) % slides.length;
      slides[current].classList.add("is-active");
      if (dots[current]) dots[current].classList.add("is-active");
    }
    function nextSlide() { goTo(current + 1); }
    function prevSlide() { goTo(current - 1); }

    if (nextBtn) nextBtn.addEventListener("click", nextSlide);
    if (prevBtn) prevBtn.addEventListener("click", prevSlide);
    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        goTo(parseInt(dot.getAttribute("data-index"), 10));
      });
    });
  }

  var WISHLIST_KEY = "jody_wishlist";

  function getWishlist() {
    try {
      var raw = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function saveWishlist(ids) {
    try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids)); } catch (e) {}
  }

  function isWishlisted(id) {
    return getWishlist().indexOf(id) !== -1;
  }

  function toggleWishlist(id) {
    var ids = getWishlist();
    var i = ids.indexOf(id);
    if (i === -1) ids.push(id); else ids.splice(i, 1);
    saveWishlist(ids);
    updateWishlistButtons(id);
    updateWishlistBadge();
    return ids.indexOf(id) !== -1;
  }

  function updateWishlistButtons(id) {
    var saved = isWishlisted(id);
    document.querySelectorAll('[data-wishlist-toggle][data-product-id="' + id + '"]').forEach(function (btn) {
      btn.classList.toggle("is-saved", saved);
      var label = btn.querySelector("[data-wishlist-label]");
      if (label) label.textContent = saved ? (btn.getAttribute("data-remove-text") || label.textContent) : (btn.getAttribute("data-add-text") || label.textContent);
    });
  }

  function updateWishlistBadge() {
    var count = getWishlist().length;
    document.querySelectorAll("[data-wishlist-count]").forEach(function (el) {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  }

  document.querySelectorAll("[data-wishlist-toggle]").forEach(function (btn) {
    var id = btn.getAttribute("data-product-id");
    if (!id) return;

    var labelEl = btn.querySelector("[data-wishlist-label]");
    if (labelEl && !btn.getAttribute("data-add-text")) {
      btn.setAttribute("data-add-text", labelEl.textContent);
    }
    btn.classList.toggle("is-saved", isWishlisted(id));

    btn.addEventListener("click", function (e) {

      e.preventDefault();
      e.stopPropagation();
      toggleWishlist(id);
    });
  });
  updateWishlistBadge();

  var wishlistPage = document.querySelector("[data-wishlist-page]");
  if (wishlistPage) {
    var statusEl = wishlistPage.querySelector("[data-wishlist-status]");
    var gridEl = wishlistPage.querySelector("[data-wishlist-grid]");
    var prefix = wishlistPage.getAttribute("data-prefix") || "";
    var locale = wishlistPage.getAttribute("data-locale") || "en";
    var ids = getWishlist();

    function heartSvg() {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-6.7-4.35-9.3-8.1C1 10.2 1.4 6.6 4.4 4.9c2.4-1.4 5.2-.6 6.6 1.4l1 1.4 1-1.4c1.4-2 4.2-2.8 6.6-1.4 3 1.7 3.4 5.3 1.7 8-2.6 3.75-9.3 8.1-9.3 8.1z"/></svg>';
    }

    function renderEmpty() {
      statusEl.textContent = wishlistPage.getAttribute("data-empty-text");
      var cta = document.createElement("a");
      cta.href = prefix + "/shop";
      cta.className = "btn btn-primary btn-sm";
      cta.style.marginTop = "12px";
      cta.style.display = "inline-block";
      cta.textContent = wishlistPage.getAttribute("data-empty-cta-text");
      statusEl.appendChild(document.createElement("br"));
      statusEl.appendChild(cta);
    }

    function renderProducts(products) {
      if (products.length === 0) return renderEmpty();
      statusEl.hidden = true;
      gridEl.hidden = false;
      products.forEach(function (product) {
        var name = (product.name && (product.name[locale] || product.name.en)) || "";
        var price = product.priceEGP + " ج.م";
        var a = document.createElement("a");
        a.href = prefix + "/product/" + product.slug;
        a.className = "product-card";
        a.innerHTML =
          '<div class="product-card__image">' +
            '<img src="' + toThumb(product.images && product.images[0] || "").replace(/"/g, "&quot;") + '" alt="" loading="lazy" />' +
            '<button type="button" class="wishlist-heart is-saved" data-wishlist-toggle data-product-id="' + product._id + '" aria-label="' + wishlistPage.getAttribute("data-remove-aria") + '">' + heartSvg() + '</button>' +
          '</div>' +
          '<h2 class="product-card__name"></h2>' +
          '<p class="product-card__price"></p>';
        a.querySelector(".product-card__name").textContent = name;
        a.querySelector(".product-card__price").textContent = price;
        gridEl.appendChild(a);

        var heartBtn = a.querySelector("[data-wishlist-toggle]");
        heartBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleWishlist(product._id);
          a.remove();
          if (!gridEl.querySelector(".product-card")) {
            gridEl.hidden = true;
            statusEl.hidden = false;
            statusEl.textContent = "";
            renderEmpty();
          }
        });
      });
    }

    if (ids.length === 0) {
      renderEmpty();
    } else {
      fetch("/api/products?ids=" + encodeURIComponent(ids.join(",")))
        .then(function (res) { return res.json(); })
        .then(function (json) { renderProducts((json && json.data && json.data.products) || []); })
        .catch(function () {
          statusEl.textContent = wishlistPage.getAttribute("data-empty-text");
        });
    }
  }
});
