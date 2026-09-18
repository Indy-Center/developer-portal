import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";

export default defineConfig({
  site: "https://tech.flyindycenter.com",
  integrations: [
    starlight({
      title: "Indy Center Tech",
      plugins: [starlightLinksValidator()],
      customCss: ["./src/styles/theme.css"],
      editLink: {
        baseUrl: "https://github.com/Indy-Center/developer-portal/edit/main/",
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/Indy-Center",
        },
      ],
      sidebar: [
        {
          label: "Start here",
          items: [{ autogenerate: { directory: "start-here" } }],
        },
        {
          label: "Projects",
          items: [{ autogenerate: { directory: "projects" } }],
        },
        {
          label: "Development",
          items: [{ autogenerate: { directory: "development" } }],
        },
        {
          label: "Patterns",
          items: [{ autogenerate: { directory: "patterns" } }],
        },
        {
          label: "Working agreements",
          items: [{ autogenerate: { directory: "agreements" } }],
        },
      ],
    }),
  ],
});
