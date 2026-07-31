export type FileNode = {
  kind: "file";
  /** Filename with extension, as displayed in the explorer. */
  name: string;
  /** URL path without extension. The landing page uses "". */
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
  { kind: "file", name: "README.md", path: "", source: "README.md", title: "README" },
  { kind: "file", name: "whoami.md", path: "whoami", source: "whoami.md", title: "whoami" },
  { kind: "file", name: "experience.log", path: "experience", source: "experience.log", title: "experience" },
  {
    kind: "dir",
    name: "projects",
    path: "projects",
    title: "projects",
    children: [
      { kind: "file", name: "one.md", path: "projects/one", source: "projects/one.md", title: "project one" },
      { kind: "file", name: "two.md", path: "projects/two", source: "projects/two.md", title: "project two" },
    ],
  },
  { kind: "file", name: "stack.json", path: "stack", source: "stack.json", title: "stack" },
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
