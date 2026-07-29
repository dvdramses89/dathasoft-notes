import { createCodeBlockSpec } from '@blocknote/core';

/**
 * Lenguajes disponibles en los bloques de codigo. Se cargan de forma perezosa:
 * shiki (el resaltador) y sus gramaticas solo se descargan la primera vez que
 * se abre un bloque de codigo, no en el arranque de la app.
 */
const LANGUAGES: Record<string, { name: string; aliases?: string[] }> = {
  text: { name: 'Texto plano' },
  bash: { name: 'Bash / Shell', aliases: ['sh', 'shell', 'zsh'] },
  json: { name: 'JSON' },
  yaml: { name: 'YAML', aliases: ['yml'] },
  sql: { name: 'SQL' },
  javascript: { name: 'JavaScript', aliases: ['js'] },
  typescript: { name: 'TypeScript', aliases: ['ts'] },
  tsx: { name: 'TSX / JSX', aliases: ['jsx'] },
  html: { name: 'HTML' },
  css: { name: 'CSS' },
  python: { name: 'Python', aliases: ['py'] },
  java: { name: 'Java' },
  csharp: { name: 'C#', aliases: ['cs'] },
  php: { name: 'PHP' },
  go: { name: 'Go', aliases: ['golang'] },
  rust: { name: 'Rust', aliases: ['rs'] },
  docker: { name: 'Dockerfile', aliases: ['dockerfile'] },
  markdown: { name: 'Markdown', aliases: ['md'] },
  xml: { name: 'XML' },
  diff: { name: 'Diff' },
  prisma: { name: 'Prisma' },
};

export const codeBlockSpec = createCodeBlockSpec({
  defaultLanguage: 'text',
  indentLineWithTab: true,
  supportedLanguages: LANGUAGES,
  createHighlighter: () =>
    // Import dinamico: shiki queda fuera del bundle inicial.
    import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-dark-default'],
        langs: Object.keys(LANGUAGES).filter((lang) => lang !== 'text'),
      }),
    ),
});
