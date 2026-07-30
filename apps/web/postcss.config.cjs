// Config de PostCSS que pide Mantine. Aporta dos cosas que usamos en index.css:
// la funcion `light-dark()` (un valor por tema, sin duplicar selectores) y los
// mixins de breakpoints (`@media (max-width: $mantine-breakpoint-sm)`).
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
};
