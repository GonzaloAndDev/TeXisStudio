import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://gonzaloanddev.github.io",
  base: "/TeXisStudio",
  integrations: [
    starlight({
      title: {
        es: "Documentación de TeXisStudio",
        en: "TeXisStudio Documentation",
      },
      description: "Documentación oficial bilingüe de TeXisStudio.",
      locales: {
        root: { label: "Español", lang: "es" },
        en: { label: "English", lang: "en" },
      },
      sidebar: [
        {
          label: "Uso de la app",
          translations: { en: "Using the app" },
          items: [{ autogenerate: { directory: "app" } }],
        },
        {
          label: "Uso de LaTeX",
          translations: { en: "Using LaTeX" },
          items: [{ autogenerate: { directory: "latex" } }],
        },
        {
          label: "Contribuir",
          translations: { en: "Contributing" },
          items: [{ autogenerate: { directory: "contributing" } }],
        },
      ],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/GonzaloAndDev/TeXisStudio" },
      ],
      editLink: {
        baseUrl: "https://github.com/GonzaloAndDev/TeXisStudio/edit/main/docs-site/",
      },
      customCss: ["./src/styles/custom.css"],
      lastUpdated: true,
      credits: true,
    }),
  ],
});
