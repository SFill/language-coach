export function getUniqueTokens(phrase) {
    // normalize, then split by spaces
    const normalized = normalizePhrase(phrase);
    return new Set(normalized.split(/\s+/).filter(Boolean));
}

export function areCloseMatches(phraseA, phraseB) {
    // play around with that
    const tokensA = getUniqueTokens(phraseA);
    const tokensB = getUniqueTokens(phraseB);

    if (!(tokensA.size >= 2 || tokensB.size >= 2)) return false;

    // Count unique tokens across both sets
    const union = new Set([...tokensA, ...tokensB]);
    // Count tokens in the intersection
    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));

    if (tokensB.size == 1) {
        // one word in phrase
        return intersection.size > 0
    }
    // phrases
    return intersection.size / union.size >= 0.5;
}

export function isPartOfPhrase(phraseA, phraseB) {
    const tokensA = getUniqueTokens(phraseA);
    const tokensB = getUniqueTokens(phraseB);

    if (!(tokensB.size <= 2)) return false;

    // Count unique tokens across both sets
    const union = new Set([...tokensA, ...tokensB]);
    // Count tokens in the intersection
    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));

    // Number of different tokens is union - intersection
    const diffCount = union.size - intersection.size;
    return diffCount > 0;
}

// Helper function to normalize a phrase: lowercase, remove punctuation, and strip common articles
export function normalizePhrase(phrase) {
    return phrase
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?!]/g, "")
        .replace(/^(|a|an)\s+/, "")
        .trim();
    // TODO remove the except phrases like the best, the sun, and etc, like that are used only with that
}

// export { areCloseMatches, getUniqueTokens }