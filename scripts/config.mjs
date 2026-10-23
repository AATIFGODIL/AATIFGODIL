/**
 * What the profile says. `build.mjs` turns this, plus what GitHub reports,
 * into the SVGs in `svg/` and the README that stacks them.
 */
export default {
  login: "AATIFGODIL",
  site: { url: "https://aatifgodil.in", label: "AATIFGODIL.IN" },

  /** Under the name, one at a time — the portfolio's taglines, in its order. */
  taglines: ["DEVELOPER.", "ATHLETE.", "STUDENT.", "FOUNDER."],

  /**
   * The number on the contributions panel, for the last year. `null` is
   * GitHub's own count, refreshed every day — private repos included, now
   * the profile shares private contributions. A number pins it instead.
   */
  contributions: null,

  repos: {
    /** Public, not forks, newest push first; minus these. */
    exclude: ["AATIFGODIL"],
    /** How a repo's name is set, where its slug isn't how it's said. */
    names: {
      "Fieldday-Ground-Control": "Ground Control",
      "Second-Door": "Second Door",
      PurposeEra: "Purpose Era",
    },
  },

  /** The portfolio's tools, in its order. `icon` is a file in assets/icons. */
  tools: [
    { name: "Python", icon: "python" },
    { name: "JavaScript", icon: "javascript" },
    { name: "TypeScript", icon: "typescript" },
    { name: "Java", icon: "openjdk" },
    { name: "Go", icon: "go" },
    { name: "React", icon: "react" },
    { name: "Next.js", icon: "nextdotjs" },
    { name: "Tailwind", icon: "tailwindcss" },
    { name: "Vercel", icon: "vercel" },
    { name: "Figma", icon: "figma" },
    { name: "Node.js", icon: "nodedotjs" },
    { name: "Express", icon: "express" },
    { name: "Firebase", icon: "firebase" },
    { name: "Prisma", icon: "prisma" },
    { name: "Cloudflare", icon: "cloudflare" },
    { name: "Expo", icon: "expo" },
    { name: "Google Cloud", icon: "googlecloud" },
    { name: "Antigravity", icon: "antigravity" },
  ],
};
