export type FileNode = {
  kind: "file";
  /** Filename with extension, as displayed in the explorer. */
  name: string;
  /** URL path without extension. Never "" — "/" is the empty state, handled in
   * [[...path]]/page.tsx with no manifest entry. */
  path: string;
  /** Path relative to src/content/files. */
  source: string;
  title: string;
};

export type DirNode = {
  kind: "dir";
  name: string;
  path: string;
  title: string;
  children: ContentNode[];
};

export type ContentNode = FileNode | DirNode;

export const manifest: ContentNode[] = [
  { kind: "file", name: "README.md", path: "readme", source: "README.md", title: "README" },
  { kind: "file", name: "whoami.md", path: "whoami", source: "whoami.md", title: "whoami" },
  { kind: "file", name: "experience.log", path: "experience", source: "experience.log", title: "experience" },
  {
    kind: "dir",
    name: "projects",
    path: "projects",
    title: "projects",
    children: [
      {
        kind: "dir",
        name: "personal",
        path: "projects/personal",
        title: "personal",
        children: [
          { kind: "file", name: "1kout.md", path: "projects/personal/1kout", source: "projects/personal/1kout.md", title: "1kout" },
          { kind: "file", name: "shapeshift.md", path: "projects/personal/shapeshift", source: "projects/personal/shapeshift.md", title: "shapeshift" },
          { kind: "file", name: "portfolios.md", path: "projects/personal/portfolios", source: "projects/personal/portfolios.md", title: "portfolios" },
        ],
      },
      {
        kind: "dir",
        name: "professional",
        path: "projects/professional",
        title: "professional",
        children: [
          { kind: "file", name: "migration.md", path: "projects/professional/migration", source: "projects/professional/migration.md", title: "migration" },
          { kind: "file", name: "uamps-app.md", path: "projects/professional/uamps-app", source: "projects/professional/uamps-app.md", title: "uamps-app" },
          { kind: "file", name: "uamps-com.md", path: "projects/professional/uamps-com", source: "projects/professional/uamps-com.md", title: "uamps-com" },
          { kind: "file", name: "passwords.md", path: "projects/professional/passwords", source: "projects/professional/passwords.md", title: "passwords" },
        ],
      },
    ],
  },
  { kind: "file", name: "stack.json", path: "stack", source: "stack.json", title: "stack" },
  { kind: "file", name: "favorites.json", path: "favorites", source: "favorites.json", title: "favorites" },
  { kind: "file", name: "contact.json", path: "contact", source: "contact.json", title: "contact" },
  {
    kind: "dir",
    name: "assets",
    path: "assets",
    title: "assets",
    children: [
      { kind: "file", name: "je-mark.svg", path: "assets/je-mark", source: "assets/je-mark.svg", title: "je-mark" },
    ],
  },
];
