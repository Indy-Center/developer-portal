export type ProjectStatus = "active" | "scaffold" | "deprecated" | "archived";

export type Project = {
  name: string;
  repo: string;
  summary: string;
  status: ProjectStatus;
  url?: string;
  replacedBy?: string;
};

export const projects: Project[] = [
  {
    name: "identity",
    repo: "https://github.com/Indy-Center/identity",
    status: "active",
    url: "https://auth.flyindycenter.com",
    summary:
      "Centralized identity Worker for *.flyindycenter.com. Owns VATSIM Connect OAuth, session cookies, users and roles, and exposes one typed RPC method over service bindings.",
  },
  {
    name: "community-website",
    repo: "https://github.com/Indy-Center/community-website",
    status: "active",
    url: "https://flyindycenter.com",
    summary:
      "SvelteKit app serving flyindycenter.com — roster, events, feedback, visit requests and admin tooling. Still runs its own session system; migration to identity is planned but not started.",
  },
  {
    name: "charts",
    repo: "https://github.com/Indy-Center/charts",
    status: "active",
    url: "https://charts.flyindycenter.com",
    summary:
      "SvelteKit app serving charts.flyindycenter.com — FAA terminal procedures for the current AIRAC cycle. The reference implementation for consuming identity.",
  },
  {
    name: "developer-portal",
    repo: "https://github.com/Indy-Center/developer-portal",
    status: "active",
    url: "https://tech.flyindycenter.com",
    summary:
      "This site. Astro and Starlight on Cloudflare Workers; every page has an edit link.",
  },
  {
    name: "discord-bot",
    repo: "https://github.com/Indy-Center/discord-bot",
    status: "active",
    summary:
      "Hono Worker bridging Discord forum posts to GitHub issues. Moderators triage with /accept, /deny and /done; issue closes sync back to the thread.",
  },
  {
    name: "adapter-cloudflare",
    repo: "https://github.com/Indy-Center/adapter-cloudflare",
    status: "active",
    summary:
      "Fork of @sveltejs/adapter-cloudflare, Workers-only, fixing the build output path so a custom worker entrypoint can coexist with SvelteKit's fetch handler.",
  },
  {
    name: "infrastructure",
    repo: "https://github.com/Indy-Center/infrastructure",
    status: "active",
    summary:
      "GitOps repository (ArgoCD + Kustomize) for the k3s cluster — ingress, cert-manager, sealed secrets, and manifests for every Kubernetes-hosted service.",
  },
  {
    name: "teamspeak-bot",
    repo: "https://github.com/Indy-Center/teamspeak-bot",
    status: "scaffold",
    summary:
      "Syncs TeamSpeak server groups from VATUSA roster data and prompts unlinked users to link their account. Its CI is the most complete in the org.",
  },
  {
    name: "vatisfiles",
    repo: "https://github.com/Indy-Center/vatisfiles",
    status: "active",
    summary:
      "vATIS profile configs kept current per AIRAC cycle by a scheduled Action that bumps the profile serial. Consumed by controllers' vATIS clients.",
  },
  {
    name: "airports-redirect-worker",
    repo: "https://github.com/Indy-Center/airports-redirect-worker",
    status: "active",
    url: "https://airports.indy.center",
    summary:
      "One-purpose Worker that redirects airports.indy.center to the wiki's pilots section.",
  },
  {
    name: "triage",
    repo: "https://github.com/Indy-Center/triage",
    status: "active",
    summary:
      "Issues-only repository used as a lightweight cross-cutting backlog. No code by design.",
  },
  {
    name: "controller-tools",
    repo: "https://github.com/Indy-Center/controller-tools",
    status: "deprecated",
    url: "https://tools.flyindycenter.com",
    replacedBy: "tools",
    summary:
      "The current ATC tools web app at tools.flyindycenter.com — airspace map, restrictions, charts search. Built as a Docker image and deployed on the k3s cluster via ArgoCD. The only cluster service still maintained.",
  },
  {
    name: "tools",
    repo: "https://github.com/Indy-Center/tools",
    status: "scaffold",
    url: "https://app.controller.tools",
    summary:
      "The Cloudflare Workers rewrite of controller-tools, deployed to app.controller.tools. Ships the airspace restrictions viewer.",
  },
  {
    name: "docs",
    repo: "https://github.com/Indy-Center/docs",
    status: "deprecated",
    replacedBy: "developer-portal",
    summary:
      "MkDocs technical docs site built as a Docker image and deployed on the cluster. Stale since February 2025 and superseded by this portal.",
  },
  {
    name: "wiki",
    repo: "https://github.com/Indy-Center/wiki",
    status: "deprecated",
    replacedBy: "library (planned, no repo yet)",
    summary:
      "Wiki.js instance on the VPS, still the live knowledge base for controller-facing documentation. Content has been exported to markdown; its replacement has not been built.",
  },
  {
    name: "vatsim-data-ingestor",
    repo: "https://github.com/Indy-Center/vatsim-data-ingestor",
    status: "active",
    summary:
      "Pulls the VATSIM data feed and rebroadcasts it over ZeroMQ. Runs on the k3s cluster, internal only. Not maintained — don't build against it.",
  },
  {
    name: "vatsim-data-event-processor",
    repo: "https://github.com/Indy-Center/vatsim-data-event-processor",
    status: "active",
    summary:
      "Consumes the ingestor feed and derives events, backed by Redis. Runs on the k3s cluster, internal only. Not maintained — don't build against it.",
  },
  {
    name: "vatsim-activity",
    repo: "https://github.com/Indy-Center/vatsim-activity",
    status: "scaffold",
    summary:
      "SvelteKit activity dashboard prototype deployed to an internal host. Still renders mock data.",
  },
  {
    name: "indy-discord-bot",
    repo: "https://github.com/Indy-Center/indy-discord-bot",
    status: "active",
    summary:
      "Earlier Discord bot that gamifies event participation via a passphrase-claimed role. Distinct from discord-bot; untouched since November 2025.",
  },
  {
    name: "flight-plan-manager",
    repo: "https://github.com/Indy-Center/flight-plan-manager",
    status: "archived",
    replacedBy: "direct VATSIM feed fetch inside controller-tools",
    summary:
      "Postgres and RabbitMQ API for storing flight plans. No cluster manifest exists, and controller-tools fetches the VATSIM feed directly instead.",
  },
  {
    name: "postiz-app",
    repo: "https://github.com/Indy-Center/postiz-app",
    status: "active",
    summary:
      "Self-hosted Postiz social media management deployment on the VPS. Turnkey, not actively developed.",
  },
  {
    name: "scheddy",
    repo: "https://github.com/Indy-Center/scheddy",
    status: "scaffold",
    summary:
      "Fork of ZTL ARTCC's training scheduler. No Indy Center commits, no deployment, and nothing references it — an evaluation that was never adopted.",
  },
  {
    name: "indy-moodle",
    repo: "https://github.com/Indy-Center/indy-moodle",
    status: "scaffold",
    summary:
      "Empty repository created September 2026. Intended as a Moodle LMS instance; nothing built yet.",
  },
  {
    name: "vatsim-radar-zidsectors",
    repo: "https://github.com/Indy-Center/vatsim-radar-zidsectors",
    status: "active",
    summary:
      "Fork of the third-party VATSIM Radar client carrying ZID-specific sector definitions rebased on upstream.",
  },
];
