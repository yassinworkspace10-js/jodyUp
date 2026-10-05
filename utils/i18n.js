const { SIZES } = require("../models/Product");

const SIZE_LABELS = {};
SIZES.forEach((s) => {
  SIZE_LABELS[s.key] = { en: s.en, ar: s.ar };
});

const CATEGORY_LABELS = {
  dresses: { en: "Dresses", ar: "فساتين" },
  tops: { en: "Tops", ar: "بلوزات" },
  bottoms: { en: "Bottoms", ar: "بناطيل" },
  skirts: { en: "Skirts", ar: "تنانير" },
  outerwear: { en: "Outerwear", ar: "معاطف" },
  accessories: { en: "Accessories", ar: "إكسسوارات" },
};

const dictionaries = {
  en: {
    dir: "ltr",
    brand: "Jody Office",
    tagline: "Jody Office — Wholesale Women's Clothing in Cairo, Egypt",
    metaDescription: "Jody Office is a wholesale women's clothing supplier with 27 years of experience, based in the Immobilia Building, Downtown Cairo — dresses, tops, skirts and outerwear at wholesale prices for shop owners and resellers across Egypt. Browse the catalog and order directly on WhatsApp.",
    nav_categories: "Categories",
    nav_shop: "Shop",
    nav_social: "Social Media",
    nav_search_placeholder: "Search products...",
    nav_search_aria: "Search products",
    lang_switch: "العربية",
    hero_title: "Wholesale Women's Clothing in Cairo, Egypt",
    hero_subtitle: "Jody Office is based in Cairo and supplies shop owners and resellers across Egypt with wholesale women's clothing — dresses, tops, skirts and outerwear at wholesale prices. Message us on WhatsApp to order.",
    hero_cta: "Shop the wholesale catalog",
    slider_prev: "Previous slide",
    slider_next: "Next slide",
    about_title: "About Jody Office",
    about_body: "Jody Office brings 27 years of experience in the wholesale women's clothing trade. We're based in the heart of Downtown Cairo, inside the Immobilia Building — one of Egypt's most famous and historic buildings. We work with shop owners and traders across Egypt, not individual buyers. Every category is stocked with fresh, thoughtfully chosen pieces at wholesale pricing, and every order is handled personally over WhatsApp, so you always know exactly who you're buying from.",
    shop_by_category: "Shop by category",
    featured: "Featured",
    follow_along: "Follow along",
    follow_body: "New arrivals and behind-the-scenes on our social channels.",
    shop_all: "Shop All",
    results_for: (n, q) => `${n} result${n === 1 ? "" : "s"} for "${q}"`,
    sort_by: "Sort by",
    sort_newest: "Newest",
    sort_price_asc: "Price: Low to High",
    sort_price_desc: "Price: High to Low",
    apply: "Apply",
    empty_shop: "No products here yet. Check back soon.",
    empty_shop_category: "No products here yet in this category. Check back soon.",
    sizes: "Sizes",
    colors: "Colors",
    in_stock: "In stock",
    out_of_stock: "Hot 🔥",
    low_stock: (n) => `Only ${n} left`,
    order_whatsapp: "Order on WhatsApp",
    whatsapp_missing: "WhatsApp ordering isn't configured yet.",
    whatsapp_choose_number: "Choose a number to message on WhatsApp",
    whatsapp_choose_close: "Close",
    footer_call: "Call us",
    you_might_also_like: "You might also like",
    home: "Home",
    product_not_found: "Product not found",
    page_not_found: "Page not found",
    back_to_shopping: "Back to shopping",
    footer_rights: (year) => `© ${year} Jody Office. All rights reserved.`,
    footer_follow: "Follow us",
    footer_email: "Email us",

    filter_size: "Size",
    filter_color: "Color",
    filter_price: "Price (EGP)",
    filter_price_min: "Min",
    filter_price_max: "Max",
    filter_all_sizes: "All sizes",
    filter_all_colors: "All colors",
    filter_clear: "Clear filters",
    page_prev: "Previous",
    page_next: "Next",
    page_of: (page, total) => `Page ${page} of ${total}`,

    nav_wishlist: "Wishlist",
    wishlist_add: "Save",
    wishlist_remove: "Saved",
    wishlist_add_aria: "Add to wishlist",
    wishlist_remove_aria: "Remove from wishlist",
    wishlist_page_title: "Your Wishlist",
    wishlist_empty: "You haven't saved anything yet.",
    wishlist_empty_cta: "Browse the catalog",
    wishlist_loading: "Loading your saved items…",
    whatsapp_message: (product, price, url, locale) => {
      const lines = [`Hi! I'm interested in "${product.name[locale]}"`];
      if (product.modelNumber) lines.push(`Model #: ${product.modelNumber}`);
      lines.push(`Price: ${price}`);
      if (product.sizes && product.sizes.length) lines.push(`Sizes: ${product.sizes.map((s) => (SIZE_LABELS[s] ? SIZE_LABELS[s].en : s)).join(", ")}`);
      if (product.colors && product.colors.length) lines.push(`Colors: ${product.colors.map((c) => c.name).join(", ")}`);
      lines.push(url);
      return lines.join("\n");
    },
  },
  ar: {
    dir: "rtl",
    brand: "مكتب جودي",
    tagline: "مكتب جودي لملابس الجملة في القاهرة",
    metaDescription: "مكتب جودي مكتب متخصص في بيع ملابس حريمي بالجملة، موجود في القاهرة وبيوصّل لكل مصر — فساتين وبلوزات وتنانير ومعاطف بأسعار جملة لأصحاب المحلات والتجار. تصفح الكتالوج واطلب مباشرة عبر واتساب.",
    nav_categories: "الأقسام",
    nav_shop: "المتجر",
    nav_social: "وسائل التواصل",
    nav_search_placeholder: "ابحث عن منتج...",
    nav_search_aria: "بحث عن منتجات",
    lang_switch: "English",
    hero_title: "ملابس حريمي بالجملة في القاهرة",
    hero_subtitle: "مكتب جودي في القاهرة، وبيوفر لأصحاب المحلات والتجار في كل مصر ملابس حريمي بالجملة — فساتين وبلوزات وتنانير ومعاطف بأسعار جملة. راسلنا على واتساب لإتمام الطلب.",
    hero_cta: "تصفح كتالوج الجملة",
    slider_prev: "السابق",
    slider_next: "التالي",
    about_title: "عن مكتب جودي",
    about_body: "مكتب جودي بخبرة 27 عامًا في تجارة ملابس الحريمي بالجملة، ومقره في قلب وسط البلد بالقاهرة، داخل عمارة الإيموبيليا، واحدة من أشهر وأعرق عمارات مصر. بنشتغل مع أصحاب المحلات والتجار في كل مصر مش مع المشترين الفرديين. كل قسم فيه قطع جديدة ومختارة بعناية بأسعار جملة، وكل طلب بيتابع شخصيًا عبر واتساب، فتعرف دايمًا مين اللي بتشتري منه بالظبط.",
    shop_by_category: "تسوق حسب القسم",
    featured: "مختارات مميزة",
    follow_along: "تابعنا",
    follow_body: "أحدث القطع وكواليس العمل على منصات التواصل الاجتماعي.",
    shop_all: "كل المنتجات",
    results_for: (n, q) => `${n} نتيجة عن "${q}"`,
    sort_by: "ترتيب حسب",
    sort_newest: "الأحدث",
    sort_price_asc: "السعر: من الأقل للأعلى",
    sort_price_desc: "السعر: من الأعلى للأقل",
    apply: "تطبيق",
    empty_shop: "لا توجد منتجات بعد. تابعنا قريبًا.",
    empty_shop_category: "لا توجد منتجات في هذا القسم بعد. تابعنا قريبًا.",
    sizes: "المقاسات",
    colors: "الألوان",
    in_stock: "متوفر",
    out_of_stock: "هوت 🔥",
    low_stock: (n) => `متبقي ${n} بس`,
    order_whatsapp: "اطلب عبر واتساب",
    whatsapp_missing: "الطلب عبر واتساب غير مفعّل حاليًا.",
    whatsapp_choose_number: "اختار رقم تتواصل معاه عبر واتساب",
    whatsapp_choose_close: "إغلاق",
    footer_call: "اتصل بينا",
    you_might_also_like: "قد يعجبك أيضًا",
    home: "الرئيسية",
    product_not_found: "المنتج غير موجود",
    page_not_found: "الصفحة غير موجودة",
    back_to_shopping: "العودة للتسوق",
    footer_rights: (year) => `© ${year} مكتب جودي. جميع الحقوق محفوظة.`,
    footer_follow: "تابعنا",
    footer_email: "راسلنا عبر الإيميل",

    filter_size: "المقاس",
    filter_color: "اللون",
    filter_price: "السعر (ج.م)",
    filter_price_min: "من",
    filter_price_max: "إلى",
    filter_all_sizes: "كل المقاسات",
    filter_all_colors: "كل الألوان",
    filter_clear: "مسح الفلاتر",
    page_prev: "السابق",
    page_next: "التالي",
    page_of: (page, total) => `صفحة ${page} من ${total}`,

    nav_wishlist: "المفضلة",
    wishlist_add: "حفظ",
    wishlist_remove: "محفوظ",
    wishlist_add_aria: "إضافة للمفضلة",
    wishlist_remove_aria: "إزالة من المفضلة",
    wishlist_page_title: "المفضلة عندك",
    wishlist_empty: "لسه مفيش حاجة محفوظة.",
    wishlist_empty_cta: "تصفح الكتالوج",
    wishlist_loading: "بنجيب المفضلة عندك…",
    whatsapp_message: (product, price, url, locale) => {
      const lines = [`مرحبًا! أنا مهتم بـ "${product.name[locale]}"`];
      if (product.modelNumber) lines.push(`رقم الموديل: ${product.modelNumber}`);
      lines.push(`السعر: ${price}`);
      if (product.sizes && product.sizes.length) lines.push(`المقاسات: ${product.sizes.map((s) => (SIZE_LABELS[s] ? SIZE_LABELS[s].ar : s)).join(", ")}`);
      if (product.colors && product.colors.length) lines.push(`الألوان: ${product.colors.map((c) => c.name).join(", ")}`);
      lines.push(url);
      return lines.join("\n");
    },
  },
};

function categoryLabel(category, locale) {
  const entry = CATEGORY_LABELS[category];
  return entry ? entry[locale] : category;
}

function formatPrice(product) {
  return `${product.priceEGP} ج.م`;
}

module.exports = { dictionaries, CATEGORY_LABELS, categoryLabel, formatPrice };
