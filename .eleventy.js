export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'docs/assets': 'assets' });

  eleventyConfig.addCollection('guides', (collectionApi) =>
    collectionApi
      .getFilteredByGlob('docs/guides/*.md')
      .filter((item) => !item.inputPath.endsWith('/guides/index.md'))
      .sort((left, right) => (left.data.order ?? 0) - (right.data.order ?? 0))
  );

  eleventyConfig.addCollection('useCases', (collectionApi) =>
    collectionApi
      .getFilteredByGlob('docs/use-cases/*.md')
      .filter((item) => !item.inputPath.endsWith('/use-cases/index.md'))
      .sort((left, right) => (left.data.order ?? 0) - (right.data.order ?? 0))
  );

  return {
    dir: {
      input: 'docs',
      includes: '_includes',
      data: '_data',
      output: '_site'
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    pathPrefix: '/gitrole/'
  };
}
