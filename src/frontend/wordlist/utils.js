export function getUniqueTokens(phrase) {
    // normalize, then split by spaces
    const normalized = normalizePhrase(phrase);
    return new Set(normalized.split(/\s+/).filter(Boolean));
}

export function areCloseMatches(phraseA, phraseB) {
    const tokensA = getUniqueTokens(phraseA);
    const tokensB = getUniqueTokens(phraseB);

    if (!(tokensA.size >= 4 || tokensB.size >= 4)) return false;

    // Count unique tokens across both sets
    const union = new Set([...tokensA, ...tokensB]);
    // Count tokens in the intersection
    const intersection = new Set([...tokensA].filter(x => tokensB.has(x)));

    // Number of different tokens is union - intersection
    const diffCount = union.size - intersection.size;
    return diffCount <= 2;
}

export function isPartOfPhrase(phraseA, phraseB){
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
    // tODO remove the except phrases like the best, the sun, and etc, like that are used only with that
}

// export { areCloseMatches, getUniqueTokens }