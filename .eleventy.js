const docsBaseUrl = 'https://docs.gitrole.dev';

function absoluteUrl(value = '') {
  if (!value) {
    return docsBaseUrl;
  }

  if (/^https?:\/\//.test(value)) {
    return value;
  }

  const normalizedBaseUrl = docsBaseUrl.replace(/\/$/, '');
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'docs/assets': 'assets' });
  eleventyConfig.addPassthroughCopy({ 'docs/CNAME': 'CNAME' });
  eleventyConfig.addFilter('absoluteUrl', absoluteUrl);

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
    pathPrefix: '/'
  };
}
