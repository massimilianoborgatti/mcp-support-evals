import type { Article } from './fixtures.js';

const stopWords = new Set(
  'a an are can do does for how i in is it my of on the to what when where with you'.split(
    ' ',
  ),
);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => !stopWords.has(token),
  );
}

export function createHelpSearch(articles: readonly Article[]) {
  const documents = articles.map((article) => {
    const tokens = tokenize(`${article.title} ${article.body}`);
    const frequencies = new Map<string, number>();

    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }

    return { article, length: tokens.length, frequencies };
  });

  const averageLength =
    documents.reduce((sum, document) => sum + document.length, 0) /
    documents.length;
  const documentFrequencies = new Map<string, number>();
  for (const document of documents) {
    for (const term of document.frequencies.keys()) {
      documentFrequencies.set(term, (documentFrequencies.get(term) ?? 0) + 1);
    }
  }

  return (query: string, limit: number) => {
    const terms = new Set(tokenize(query));
    const k1 = 1.2;
    const b = 0.75;

    return documents
      .map(({ article, length, frequencies }) => {
        let score = 0;
        const lengthPenalty = k1 * (1 - b + b * (length / averageLength));

        for (const term of terms) {
          const frequency = frequencies.get(term) ?? 0;
          if (frequency === 0) continue;

          const documentFrequency = documentFrequencies.get(term) ?? 0;
          const idf = Math.log1p(
            (documents.length - documentFrequency + 0.5) /
              (documentFrequency + 0.5),
          );
          score += idf * ((frequency * (k1 + 1)) / (frequency + lengthPenalty));
        }

        return { article, score };
      })
      .filter(({ score }) => score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.article.id.localeCompare(right.article.id),
      )
      .slice(0, limit)
      .map(({ article: { id, title, body } }) => ({
        id,
        title,
        snippet:
          body.length <= 160
            ? body
            : `${body.slice(0, 157).replace(/\s+\S*$/, '')}…`,
      }));
  };
}
