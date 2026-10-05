const mongoose = require("mongoose");

const bilingual = { en: { type: String, required: true, trim: true }, ar: { type: String, required: true, trim: true } };

const phoneEntry = {
  label: { type: String, trim: true, default: "" },
  number: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
};

const settingsSchema = new mongoose.Schema(
  {
    whatsappNumber: { type: String, default: "", trim: true }, // legacy, kept only so old docs can migrate below
    whatsappNumbers: [phoneEntry],
    contactNumbers: [phoneEntry],
    socialLinks: [
      {
        name: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
      },
    ],
    tagline: bilingual,
    metaDescription: bilingual,
    hero: {
      title: bilingual,
      subtitle: bilingual,
      cta: bilingual,
    },
    about: {
      title: bilingual,
      body: bilingual,
    },
    footer: {
      email: { type: String, default: "goudywomenswear@gmail.com", trim: true },
      rightsText: bilingual,
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model("Settings", settingsSchema);

const FOOTER_DEFAULTS = {
  email: "goudywomenswear@gmail.com",
  rightsText: { en: "Jody Office. All rights reserved.", ar: "مكتب جودي. جميع الحقوق محفوظة." },
};

Settings.getSingleton = async function () {
  let doc = await Settings.findOne();
  if (!doc) {
    const { dictionaries } = require("../utils/i18n");
    const socialLinks = require("../config/socialLinks");
    doc = await Settings.create({
      whatsappNumbers: process.env.WHATSAPP_NUMBER ? [{ label: "", number: process.env.WHATSAPP_NUMBER, active: true }] : [],
      contactNumbers: [],
      socialLinks,
      tagline: { en: dictionaries.en.tagline, ar: dictionaries.ar.tagline },
      metaDescription: { en: dictionaries.en.metaDescription, ar: dictionaries.ar.metaDescription },
      hero: {
        title: { en: dictionaries.en.hero_title, ar: dictionaries.ar.hero_title },
        subtitle: { en: dictionaries.en.hero_subtitle, ar: dictionaries.ar.hero_subtitle },
        cta: { en: dictionaries.en.hero_cta, ar: dictionaries.ar.hero_cta },
      },
      about: {
        title: { en: dictionaries.en.about_title, ar: dictionaries.ar.about_title },
        body: { en: dictionaries.en.about_body, ar: dictionaries.ar.about_body },
      },
      footer: FOOTER_DEFAULTS,
    });
  } else {
    let dirty = false;
    if (!doc.footer || !doc.footer.rightsText || !doc.footer.rightsText.en) {
      doc.footer = FOOTER_DEFAULTS;
      dirty = true;
    }
    if (!doc.whatsappNumbers || !doc.whatsappNumbers.length) {
      doc.whatsappNumbers = doc.whatsappNumber ? [{ label: "", number: doc.whatsappNumber, active: true }] : [];
      dirty = true;
    }
    if (!doc.contactNumbers) {
      doc.contactNumbers = [];
      dirty = true;
    }
    if (dirty) await doc.save();
  }
  return doc;
};

module.exports = Settings;
